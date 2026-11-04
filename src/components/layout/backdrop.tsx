/**
 * The wall every glass pane lies on: soft fields of colour on a navy (or, in
 * the light theme, pearl) base, a fine grid fading toward the bottom, a
 * breath of grain, and three glows that drift so slowly they are felt rather
 * than seen. Fixed behind the page, no pointer events; `.aurora` in
 * globals.css does the drawing. Mounted once by the app shell, and by the
 * sign-in page, which has no shell.
 */
export function Backdrop() {
  return (
    <div className="aurora" aria-hidden>
      <span />
      <span />
      <span />
    </div>
  )
}
