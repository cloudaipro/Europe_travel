# Architect Brief

## Initiative — Standalone iOS Version (continued)

Steps 8-15 complete. Now Step 16.

---

## Step 16 — Camera + Filesystem + Voice Recorder (Native iOS Capture)

**Scope:** Replace the existing demo-data photo + voice handlers on iOS with real native capture. Install Capacitor Camera, Filesystem, and Voice Recorder plugins. Override `window.addPhoto` and `window.recordVoice` after the SPA defines them. Persist file paths via the existing fetch interceptor (no new endpoints).

Web behavior **unchanged** — the existing demo handlers stay as the web fallback.

### Plugin Picks (Capacitor 6 compatible)

```bash
npm install @capacitor/camera @capacitor/filesystem capacitor-voice-recorder \
  --workspace=@tourcompanion/ios
npx cap sync ios
```

Plugin choice:
- `@capacitor/camera@^6` — official, photo + photo-library
- `@capacitor/filesystem@^6` — official, Data directory writes
- `capacitor-voice-recorder@^6` — community, returns base64-encoded m4a. (If not available for Cap 6, fall back to `@capacitor-community/voice-recorder` and document the substitution.)

### iOS Permissions — `packages/ios/ios/App/App/Info.plist`

Add usage descriptions (Apple requires these strings or app crashes on first prompt):

```xml
<key>NSCameraUsageDescription</key>
<string>Take photos at your tour stops.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Pick photos for your tour stops.</string>
<key>NSPhotoLibraryAddUsageDescription</key>
<string>Save tour photos to your library.</string>
<key>NSMicrophoneUsageDescription</key>
<string>Record voice notes at your tour stops.</string>
```

### New File — `packages/ios/src/runtime/capture/index.ts`

```ts
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { VoiceRecorder } from "capacitor-voice-recorder";

/** Capture a photo, persist to app Data directory, return relative path. */
export async function capturePhoto(): Promise<{ path: string; uri: string }> {
  const img = await Camera.getPhoto({
    quality: 80,
    allowEditing: false,
    resultType: CameraResultType.Base64,
    source: CameraSource.Prompt,
    saveToGallery: false,
  });
  if (!img.base64String) throw new Error("no_photo_data");
  const filename = `photo-${Date.now()}.${img.format ?? "jpg"}`;
  const written = await Filesystem.writeFile({
    path: `photos/${filename}`,
    data: img.base64String,
    directory: Directory.Data,
    recursive: true,
  });
  return { path: `photos/${filename}`, uri: written.uri };
}

/** Record voice note, persist .m4a, return relative path + (placeholder) transcript. */
export async function recordVoiceNote(): Promise<{ path: string; transcript: string }> {
  const granted = await VoiceRecorder.requestAudioRecordingPermission();
  if (!granted.value) throw new Error("microphone_denied");
  await VoiceRecorder.startRecording();
  // Modal UX is handled by the caller (showVoiceModal). The caller invokes
  // stopAndSaveVoiceNote() when the user taps "Stop".
  throw new Error("recordVoiceNote should not be awaited; use start/stop pair");
}

export async function startVoice(): Promise<void> {
  const granted = await VoiceRecorder.requestAudioRecordingPermission();
  if (!granted.value) throw new Error("microphone_denied");
  await VoiceRecorder.startRecording();
}

export async function stopVoice(): Promise<{ path: string; transcript: string; durationMs: number }> {
  const res = await VoiceRecorder.stopRecording();
  // res.value.recordDataBase64 contains the m4a payload.
  const base64 = res.value.recordDataBase64;
  const ms = res.value.msDuration;
  const filename = `voice-${Date.now()}.m4a`;
  await Filesystem.writeFile({
    path: `voice/${filename}`,
    data: base64,
    directory: Directory.Data,
    recursive: true,
  });
  return { path: `voice/${filename}`, transcript: "", durationMs: ms };
}
```

### Override Frontend Handlers — `packages/ios/src/runtime/entry.ts`

Append after the fetch interceptor is installed:

```ts
import { capturePhoto, startVoice, stopVoice } from "./capture";

document.addEventListener("DOMContentLoaded", () => {
  // Overwrite the SPA's demo handlers with native capture.
  (window as any).addPhoto = async (day: number, idx: number) => {
    const stopId = (window as any)._stopIdFor?.(day, idx);
    if (!stopId) return;
    try {
      const { path } = await capturePhoto();
      const res = await fetch(`/api/stops/${stopId}/photos-link`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path }),
      });
      if (!res.ok) throw new Error(`photo save failed (${res.status})`);
      (window as any).STATE.stop_photos[`${day}-${idx}`] ??= [];
      (window as any).STATE.stop_photos[`${day}-${idx}`].push(path);
      (window as any).showSnack("📷 Photo captured");
      (window as any).renderTour(); (window as any).renderMemory();
    } catch (e: any) {
      (window as any).showSnack("Photo failed: " + (e?.message ?? e));
    }
  };

  (window as any).recordVoice = async (day: number, idx: number) => {
    const stopId = (window as any)._stopIdFor?.(day, idx);
    if (!stopId) return;
    try {
      await startVoice();
      // Simple v1 UX: confirm dialog to stop. Replace with a modal in Step 19.
      const proceed = window.confirm("Recording… tap OK to stop");
      const { path, transcript } = await stopVoice();
      if (!proceed) {
        (window as any).showSnack("🎤 Cancelled");
        return;
      }
      const res = await fetch(`/api/stops/${stopId}/voice`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transcript, audio_path: path }),
      });
      if (!res.ok) throw new Error(`voice save failed (${res.status})`);
      (window as any).STATE.voice_notes[`${day}-${idx}`] = transcript || "(audio note)";
      (window as any).showSnack("🎤 Voice note saved");
      (window as any).renderTour(); (window as any).renderMemory();
    } catch (e: any) {
      (window as any).showSnack("Voice failed: " + (e?.message ?? e));
    }
  };
});
```

`window.confirm` triggers a native dialog inside WKWebView — acceptable v1; Step 19 replaces with a styled modal.

### Persistence — Both Photos and Voice Already Flow Through the Interceptor

`POST /api/stops/{id}/photos-link` → handled in Step 14's interceptor → `store.addPhoto(stopId, path)`.
`POST /api/stops/{id}/voice` → handled in Step 14's interceptor → `store.addVoiceNote({stop_id, transcript, audio_path})`.

No interceptor changes needed.

### Verification Checklist

- [ ] Three new plugins installed; `Podfile.lock` shows CapacitorCamera, CapacitorFilesystem, CapacitorVoiceRecorder (or fallback names)
- [ ] `Info.plist` has all four `NS*UsageDescription` keys
- [ ] `packages/ios/src/runtime/capture/index.ts` exists with `capturePhoto`, `startVoice`, `stopVoice`
- [ ] `entry.ts` overrides `window.addPhoto` and `window.recordVoice` on `DOMContentLoaded`
- [ ] `npm run build` green
- [ ] `npm run typecheck` green
- [ ] `xcodebuild ... build CODE_SIGNING_ALLOWED=NO` green
- [ ] `npm test` — prior 79 still pass; ok to add no new tests (native plugins not Node-runnable)
- [ ] No Python changes
- [ ] No changes to `packages/web/public/index.html` — the web demo handlers stay

### Flags Bob Must Not Guess At

- **Native capture is iOS-only.** Web `addPhoto`/`recordVoice` remain the demo handlers — do NOT modify them in `index.html`.
- **`window.confirm`** native-modal UX is a known compromise for v1. Step 19 polishes.
- **`saveToGallery: false`** — we keep photos inside app sandbox to avoid privacy-prompts and library clutter. NSPhotoLibraryAddUsageDescription is still required by Apple for the plugin to load, even if unused.
- **Filesystem `Directory.Data`** — sandboxed, persists across launches, not iCloud-synced. Correct for v1.
- **Base64 encoding** — Capacitor Filesystem `data` param expects base64 string; Camera/VoiceRecorder return base64 strings. Direct passthrough.
- **`_stopIdFor`** — exists in the SPA inline JS. The override calls `(window as any)._stopIdFor(...)`. If the function isn't exposed on window (only `const`), expose it via a tiny non-breaking edit to `index.html` — append `window._stopIdFor = _stopIdFor;` after its definition. ALSO check `showSnack`, `STATE`, `renderTour`, `renderMemory` — confirm they are window-accessible globals; if any is `const`/`let`, add the same `window.X = X` exposure line. Group exposures into a single `<script>` block right after function definitions, marked with a `// iOS bridge` comment.

---

Architect approval: [x] Pre-approved.
