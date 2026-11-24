import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { EncodingType, File, Paths } from "expo-file-system";
import { usePalette } from "../../theme/Theme";

export type VoiceNotePayload = {
  /** Wire payload (data URL) for socket/API. */
  audioUrl: string;
  /** Local file URI for reliable playback on this device. */
  playUri: string;
  durationMs: number;
};

const MAX_MS = 45_000;
const playableCache = new Map<string, string>();

async function uriToDataUrl(uri: string) {
  const base64 = await new File(uri).base64();
  const mime = /\.3gp$/i.test(uri) ? "audio/3gpp" : "audio/mp4";
  return `data:${mime};base64,${base64}`;
}

/** Data URLs often fail in the native player — materialize to a cache file. */
async function resolvePlayableUri(source: string) {
  if (!source) return "";
  if (!source.startsWith("data:")) return source;
  const cached = playableCache.get(source);
  if (cached) return cached;
  const match = /^data:([^;]+);base64,(.+)$/s.exec(source);
  if (!match) return source;
  const mime = match[1].toLowerCase();
  const ext = mime.includes("3gpp") || mime.includes("3gp") ? "3gp" : mime.includes("mpeg") || mime.includes("mp3") ? "mp3" : "m4a";
  const file = new File(Paths.cache, `voice_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}.${ext}`);
  file.create({ intermediates: true, overwrite: true });
  await file.write(match[2], { encoding: EncodingType.Base64 });
  playableCache.set(source, file.uri);
  return file.uri;
}

function formatMs(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function VoiceMic({
  onSend,
  disabled,
}: {
  onSend: (note: VoiceNotePayload) => void;
  disabled?: boolean;
}) {
  const palette = usePalette();
  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const state = useAudioRecorderState(recorder, 200);
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<VoiceNotePayload | null>(null);
  const startedAt = useRef(0);
  const stopping = useRef(false);

  async function start() {
    if (disabled || busy || armed || draft) return;
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) return;
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    startedAt.current = Date.now();
    setArmed(true);
  }

  async function stop() {
    if (!armed || stopping.current) return;
    stopping.current = true;
    setBusy(true);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      const durationMs = Math.max(
        400,
        Math.round(state.durationMillis || Date.now() - startedAt.current),
      );
      setArmed(false);
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (!uri || durationMs < 400) return;
      const audioUrl = await uriToDataUrl(uri);
      setDraft({ audioUrl, playUri: uri, durationMs });
    } catch {
      setArmed(false);
    } finally {
      stopping.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!armed) return;
    if (state.durationMillis >= MAX_MS) void stop();
  }, [armed, state.durationMillis]);

  if (draft) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View
          style={{
            borderRadius: 16,
            paddingHorizontal: 8,
            paddingVertical: 4,
            backgroundColor: palette.raised,
            borderWidth: 1,
            borderColor: palette.line,
          }}
        >
          <VoiceBubble audioUrl={draft.playUri} durationMs={draft.durationMs} mine={false} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Discard recording"
          onPress={() => setDraft(null)}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: palette.line,
          }}
        >
          <Ionicons name="trash-outline" size={16} color={palette.ink} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send voice note"
          onPress={() => {
            onSend(draft);
            setDraft(null);
          }}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: palette.accent,
          }}
        >
          <Ionicons name="send" size={14} color={palette.accentInk} />
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={armed ? "Stop recording" : "Record voice note"}
      disabled={disabled || busy}
      onPress={() => {
        if (armed) void stop();
        else void start();
      }}
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: armed ? "#C4482D" : palette.line,
      }}
    >
      {busy ? (
        <ActivityIndicator size="small" color={armed ? "#FFFFFF" : palette.ink} />
      ) : (
        <Ionicons name={armed ? "stop" : "mic"} size={18} color={armed ? "#FFFFFF" : palette.ink} />
      )}
    </Pressable>
  );
}

export function VoiceBubble({
  audioUrl,
  durationMs = 0,
  mine,
}: {
  audioUrl: string;
  durationMs?: number;
  mine: boolean;
}) {
  const palette = usePalette();
  const [source, setSource] = useState(audioUrl.startsWith("data:") ? null : audioUrl);
  const [error, setError] = useState("");
  const player = useAudioPlayer(source);
  const status = useAudioPlayerStatus(player);
  const ink = mine ? palette.accentInk : palette.ink;
  const label = formatMs(durationMs || Math.round((status.duration || 0) * 1000));

  useEffect(() => {
    let alive = true;
    setError("");
    if (!audioUrl.startsWith("data:")) {
      setSource(audioUrl);
      return;
    }
    setSource(null);
    void resolvePlayableUri(audioUrl)
      .then((uri) => {
        if (alive) setSource(uri || null);
      })
      .catch(() => {
        if (alive) setError("Can't play");
      });
    return () => {
      alive = false;
    };
  }, [audioUrl]);

  async function toggle() {
    if (!source || error) return;
    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (status.playing) {
        player.pause();
        return;
      }
      if (status.duration > 0 && status.currentTime >= status.duration - 0.08) {
        await player.seekTo(0);
      }
      player.play();
    } catch {
      setError("Can't play");
    }
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={status.playing ? "Pause voice note" : "Play voice note"}
      onPress={() => void toggle()}
      style={{ flexDirection: "row", alignItems: "center", gap: 8, minWidth: 110, minHeight: 32 }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: mine ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.06)",
        }}
      >
        {!source && !error ? (
          <ActivityIndicator size="small" color={ink} />
        ) : (
          <Ionicons name={error ? "alert" : status.playing ? "pause" : "play"} size={14} color={ink} />
        )}
      </View>
      <Text style={{ color: ink, fontWeight: "700" }}>{error || label}</Text>
    </Pressable>
  );
}
