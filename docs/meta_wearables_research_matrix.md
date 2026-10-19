# Meta Wearables Feasibility & Integration Research Matrix
**Author:** Nabeel (Reviewed with Muzzamil)  
**Date:** 19 October 2026  
**Status:** Research & Architectural Assessment (Pre-Hardware Verification)

---

## 1. Executive Summary

The current application contains a visual preview toggle labelled **"Glasses Preview (Simulation)"**. This is currently a CSS overlay simulating the heads-up display aspect ratio and peripheral framing of smart glasses.

Meta provides two distinct developer tracks for Ray-Ban and Meta smart wearables:
1. **Display Standalone Web Apps** (for glasses with heads-up displays, e.g. Orion / Display prototypes).
2. **Device Access Toolkit (DAT)** (for Ray-Ban Meta smart glasses via paired mobile iOS/Android host apps).

> [!IMPORTANT]
> Running a responsive web app inside a browser on smart glasses **does NOT automatically provide live video streaming via `navigator.mediaDevices.getUserMedia()`**. Live camera streaming on Ray-Ban Meta glasses is restricted to native mobile apps using the Meta Device Access Toolkit (DAT) with user privacy LED indicators.

---

## 2. Comparative Matrix

| Criterion | Route A: Display Web App (Browser Surface) | Route B: Device Access Toolkit (DAT Native/Hybrid) |
| :--- | :--- | :--- |
| **Target Hardware** | Meta Display Wearables (e.g. Orion prototypes) | Ray-Ban Meta Smart Glasses (Gen 1 & 2) |
| **Execution Surface** | Embedded Chromium / Wearables Web Runtime | Host iOS/Android App via Meta Wearables SDK |
| **Camera Access (`getUserMedia`)** | ⚠️ Restricted or synthetic preview; no continuous raw 1080p stream documented | ✅ Supported via native DAT video stream delegate (1080p, 30fps) |
| **Privacy Indicator** | Hardware capture LED must be illuminated | Hardware capture LED is enforced by glasses firmware |
| **Display Capabilities** | Micro-LED / Waveguide heads-up display | ❌ No visual display (Audio and LEDs only) |
| **Audio / TTS Feedback** | Supported via Web Audio API / HTML5 Audio | Supported via open-ear speakers / microphone array |
| **Authentication Flow** | Browser cookie / Web OAuth | Mobile App OAuth / Supabase native SDK |
| **Simulator / Emulation** | Meta Wearables Web Simulator | Meta Wearables Developer Companion App |
| **Acceptable Use Policy** | Real-time face recognition on strangers prohibited; caregiver memory assistance allowed with consent | Memory assistance / accessibility subject to developer application review |
| **Real Device Test Status** | Untested (hardware pending from Hasan) | Untested (hardware pending from Hasan) |

---

## 3. Recommended Architectural Integration for FYP

For our Dementia Memory Assistance system:
1. **Visual Preview (Web Portal):** Keep the current web app's AR viewer on mobile/laptop webcams for caregiver configuration, testing, and enrollment.
2. **Wearable Integration (Phase Next):**
   - Ray-Ban Meta glasses have **no screen**; they provide open-ear audio and a camera. The memory aid feedback should be delivered as **whispered audio anchors** (e.g., *"This is your daughter Sarah; you talked about gardening yesterday."*) via text-to-speech.
   - For visual heads-up AR, devices like Meta Display / Orion or phone-based AR viewers are required.
3. **Pending Hardware Confirmation:** Awaiting exact hardware model number and firmware version from Hasan before binding native DAT libraries.
