// Ambient types for the vendored GSAP ESM bundles (npm is unreachable in this
// environment, so GSAP is committed here instead of installed).
declare module '*/vendor/gsap/gsap.js' {
  const gsap: any
  export default gsap
}
declare module '*/vendor/gsap/ScrollTrigger.js' {
  const ScrollTrigger: any
  export default ScrollTrigger
  export { ScrollTrigger }
}
