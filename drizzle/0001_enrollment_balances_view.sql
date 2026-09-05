-- enrollment_balances
--
-- The single source of truth for "how much is owed". Balance is NEVER stored
-- as a column; every fee figure in the application reads this view, so it
-- cannot drift when a payment is corrected or an installment is rescheduled.
--
-- Two branches meet here:
--
--   * With a payment schedule (installments, or recurring cycles), net payable
--     is the SUM of the schedule rows. Schedule rows are generated from NET
--     payable (fee - discount), so for a one-time enrollment this equals
--     fee_total - discount exactly and the branches agree.
--
--   * Without one, net payable falls back to fee_total - discount.
--
-- Recurring memberships have no contract total, so the schedule branch is what
-- makes them representable: a Trading Floor member owes whatever cycles have
-- been raised, not some invented twelve-month figure.
--
-- "Today" is today in Pune. A due date passes at IST midnight, not UTC
-- midnight, or a Pune admin would see a fee flip to overdue five and a half
-- hours early.
--
-- WAIVED rows count toward neither what is owed nor what is overdue; they are
-- explicitly forgiven. Soft-deleted payments and enrollments are excluded.

CREATE VIEW enrollment_balances AS
WITH paid AS (
  SELECT
    enrollment_id,
    COALESCE(SUM(amount_paise), 0)::bigint AS total_paid_paise
  FROM payments
  WHERE deleted_at IS NULL
  GROUP BY enrollment_id
),
sched AS (
  SELECT
    enrollment_id,
    COUNT(*) AS row_count,
    -- WAIVED is excluded from what is payable.
    COALESCE(SUM(amount_paise) FILTER (WHERE status <> 'WAIVED'), 0)::bigint
      AS scheduled_total_paise,
    MIN(due_date) FILTER (WHERE status IN ('PENDING', 'PARTIAL', 'OVERDUE'))
      AS next_due_date,
    MIN(due_date) FILTER (
      WHERE status IN ('PENDING', 'PARTIAL', 'OVERDUE')
        AND due_date < (now() AT TIME ZONE 'Asia/Kolkata')::date
    ) AS oldest_overdue_date
  FROM payment_schedule
  GROUP BY enrollment_id
),
net AS (
  SELECT
    e.id AS enrollment_id,
    e.fee_total_paise,
    e.discount_paise,
    CASE
      WHEN COALESCE(s.row_count, 0) > 0 THEN s.scheduled_total_paise
      ELSE GREATEST(e.fee_total_paise - e.discount_paise, 0)
    END::bigint AS net_payable_paise,
    COALESCE(p.total_paid_paise, 0)::bigint AS total_paid_paise,
    s.next_due_date,
    s.oldest_overdue_date
  FROM enrollments e
  LEFT JOIN paid p ON p.enrollment_id = e.id
  LEFT JOIN sched s ON s.enrollment_id = e.id
  WHERE e.deleted_at IS NULL
)
SELECT
  n.enrollment_id,
  n.fee_total_paise,
  n.discount_paise,
  n.net_payable_paise,
  n.total_paid_paise,
  (n.net_payable_paise - n.total_paid_paise)::bigint AS balance_due_paise,

  (n.oldest_overdue_date IS NOT NULL) AS is_overdue,
  COALESCE(
    ((now() AT TIME ZONE 'Asia/Kolkata')::date - n.oldest_overdue_date),
    0
  )::integer AS days_overdue,

  n.next_due_date,
  -- What is actually due on that date: the instalment amount less whatever of
  -- it has already been settled by earlier payments (FIFO, oldest first).
  (
    SELECT GREATEST(
      ps.amount_paise - GREATEST(
        n.total_paid_paise - COALESCE((
          SELECT SUM(prior.amount_paise)
          FROM payment_schedule prior
          WHERE prior.enrollment_id = n.enrollment_id
            AND prior.status <> 'WAIVED'
            AND (prior.due_date, prior.seq) < (ps.due_date, ps.seq)
        ), 0),
        0
      ),
      0
    )::bigint
    FROM payment_schedule ps
    WHERE ps.enrollment_id = n.enrollment_id
      AND ps.due_date = n.next_due_date
      AND ps.status IN ('PENDING', 'PARTIAL', 'OVERDUE')
    ORDER BY ps.seq
    LIMIT 1
  ) AS next_due_amount_paise
FROM net n;
