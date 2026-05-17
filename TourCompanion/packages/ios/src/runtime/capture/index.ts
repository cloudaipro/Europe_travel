// Native iOS capture — Step 16. Wraps Capacitor Camera + Filesystem +
// VoiceRecorder so entry.ts can override the SPA's demo addPhoto /
// recordVoice handlers with real device capture. Files persist to the
// app's sandboxed Data directory (Directory.Data) — survives launches,
// not iCloud-synced. Photos and voice notes both round-trip through
// the Step 14 fetch interceptor; no new endpoints needed.

import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { VoiceRecorder } from "capacitor-voice-recorder";

/** Capture a photo, persist to app Data directory, return relative path + native uri. */
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

/** Begin a voice recording. Caller is responsible for invoking stopVoice() later. */
export async function startVoice(): Promise<void> {
  const granted = await VoiceRecorder.requestAudioRecordingPermission();
  if (!granted.value) throw new Error("microphone_denied");
  await VoiceRecorder.startRecording();
}

/** Stop the active recording, persist the .m4a payload, return relative path + duration. */
export async function stopVoice(): Promise<{ path: string; transcript: string; durationMs: number }> {
  const res = await VoiceRecorder.stopRecording();
  // res.value.recordDataBase64 holds the m4a payload (base64-encoded).
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
