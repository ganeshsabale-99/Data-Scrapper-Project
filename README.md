# Tech Parks Analyzer V2

This application provides tools to analyze and manage tech parks and the companies within them.

## Recently Added Features: Audit Trail & Location Validation

A robust activity logging system has been built into the platform:

1. **Chronological Logging:** Tracks mutations (Creation, Updates, Status Changes, Verifications, Deletions) against `TechParks` ensuring you have full accountability.
2. **Contact & Visit Action Logs:** Easily append physical visits or contact touches (Email, Phone, WhatsApp) natively inline next to other application operations.
3. **Diff-Tracking:** Auto-computes changed properties, parsing differences smoothly when a company/tech-park entity evolves. 
4. **Geolocation Engine:** The \`Add Visit\` and \`Add Contact Log\` portals tie into browser HTML5 \`navigator.geolocation\` allowing managers to verify spatial proximity parameters of field visits directly.
5. **Timeline UI:** Located under the \`Activity & Logs\` tab on the Tech Park Details page. All logs render visually dynamically with map-links included.
