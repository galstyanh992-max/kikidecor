import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Sparkles, Upload, X, RefreshCw, Loader2, Copy, Wand2, Film, Image as ImageIcon, ChevronDown,
} from "lucide-react";
import {
  DECOR_PRESETS, MOTION_OPTIONS, SPEED_OPTIONS, MOOD_OPTIONS, LIGHTING_OPTIONS,
  buildWanPrompt, type DecorPreset, type MotionState, type MoodState, type OutputState,
} from "@/lib/decorPresets";
import { cn } from "@/lib/utils";
import { VIDEO_PROMPT_TEMPLATES } from "@/data/decorPromptTemplates";
import WanHistory, { type WanRun, type WanSetup } from "./wan/WanHistory";
import WanPromptChat from "./wan/WanPromptChat";

type FrameKind = "first" | "last";

type Run = WanRun;

const FramePicker = ({
  kind, file, url, onPick, onClear,
}: {
  kind: FrameKind;
  file: File | null;
  url: string | null;
  onPick: (f: File) => void;
  onClear: () => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const isFirst = kind === "first";
  const preview = file ? URL.createObjectURL(file) : url;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] uppercase tracking-[0.2em] font-semibold flex items-center gap-2">
          <span className={cn("w-2 h-2 rounded-full", isFirst ? "bg-emerald-500" : "bg-amber-500")} />
          {isFirst ? "Первый кадр · НАЧАЛО" : "Последний кадр · КОНЕЦ"}
        </Label>
        {(file || url) && (
          <button onClick={onClear} className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1">
            <X size={12} /> Удалить
          </button>
        )}
      </div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f && f.type.startsWith("image/")) onPick(f);
        }}
        className={cn(
          "relative aspect-video rounded-lg border-2 border-dashed cursor-pointer overflow-hidden bg-muted/30 hover:bg-muted/60 transition",
          preview ? "border-transparent" : isFirst ? "border-emerald-500/40" : "border-amber-500/40"
        )}
      >
        {preview ? (
          <>
            <img src={preview} alt={kind} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 hover:opacity-100 transition flex items-end justify-end p-2 gap-2">
              <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}>
                <RefreshCw size={12} className="mr-1" /> Заменить
              </Button>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Upload size={20} />
            <span className="text-xs">Нажмите или перетащите изображение</span>
            <span className="text-[10px] opacity-70">{isFirst ? "Начало видео" : "Целевая финальная композиция"}</span>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
    </div>
  );
};

const PresetCard = ({ preset, active, onClick }: { preset: DecorPreset; active: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "shrink-0 snap-start text-left rounded-lg border p-3 w-[180px] transition",
      active ? "border-primary bg-primary/5 shadow-md" : "border-border hover:border-foreground/30 bg-card"
    )}
  >
    <div className="flex items-center gap-1.5 mb-2">
      {preset.swatch.map((c, i) => (
        <span key={i} className="w-5 h-5 rounded-full border border-border/40" style={{ background: c }} />
      ))}
    </div>
    <p className="font-display text-sm font-semibold leading-tight">{preset.name}</p>
    <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{preset.mood}</p>
  </button>
);

const AdminWanVideo = () => {
  const [userPrompt, setUserPrompt] = useState("");
  const [presetId, setPresetId] = useState(DECOR_PRESETS[1].id); // Quiet Luxury default
  const [motion, setMotion] = useState<MotionState>({ cameraId: "slow-pan", speed: "slow" });
  const [mood, setMood] = useState<MoodState>({ toneId: "editorial", lightingId: "soft-daylight" });
  const [output, setOutput] = useState<OutputState>({ resolution: "1080p", aspectRatio: "16:9", duration: 5, cameraFixed: false });
  const [negativePrompt, setNegativePrompt] = useState("");
  const [styleStrength, setStyleStrength] = useState(60);
  const [model, setModel] = useState<"wan2.2-plus" | "wan2.5-preview" | "veo-3.1-lite" | "veo-3.0" | "veo-3.0-fast">("veo-3.1-lite");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [firstFile, setFirstFile] = useState<File | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);

  const [runs, setRuns] = useState<Run[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [lastResult, setLastResult] = useState<{ id: string; compiledPrompt: string; lastFrameDescription: string | null } | null>(null);

  const compiledPreview = useMemo(() => buildWanPrompt({
    userPrompt: userPrompt || "(your prompt here)",
    presetId,
    motion, mood, output,
    negativePrompt,
    styleStrength,
    firstFrameUrl: null,
    lastFrameUrl: null,
    lastFrameDescription: null,
  }), [userPrompt, presetId, motion, mood, output, negativePrompt, styleStrength]);

  const loadRuns = async () => {
    setHistoryLoading(true);
    const { data } = await supabase
      .from("wan_runs")
      .select("id, created_at, status, user_prompt, compiled_prompt, preset_id, preset_name, first_frame_url, last_frame_url, last_frame_description, video_url, thumbnail_url, motion, mood, output, negative_prompt, style_strength, error_message")
      .order("created_at", { ascending: false })
      .limit(50);
    setRuns((data as Run[]) || []);
    setHistoryLoading(false);
  };

  useEffect(() => { loadRuns(); }, []);

  const uploadFrame = async (file: File, kind: FrameKind): Promise<string | null> => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${kind}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("wan-frames").upload(path, file, {
      contentType: file.type, upsert: false,
    });
    if (error) { toast.error(`Upload error: ${error.message}`); return null; }
    const { data } = supabase.storage.from("wan-frames").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleGenerate = async () => {
    if (!userPrompt.trim()) {
      toast.error("Введите промпт");
      return;
    }
    setGenerating(true);
    setLastResult(null);
    try {
      const firstUrl = firstFile ? await uploadFrame(firstFile, "first") : null;
      const lastUrl = lastFile ? await uploadFrame(lastFile, "last") : null;
      const preset = DECOR_PRESETS.find((p) => p.id === presetId)!;

      const compiledPrompt = buildWanPrompt({
        userPrompt, presetId, motion, mood, output, negativePrompt, styleStrength,
        firstFrameUrl: firstUrl, lastFrameUrl: lastUrl, lastFrameDescription: null,
      });

      const { data, error } = await supabase.functions.invoke("generate-decor-wan", {
        body: {
          userPrompt, presetId, presetName: preset.name,
          compiledPrompt, motion, mood, output,
          negativePrompt, styleStrength,
          firstFrameUrl: firstUrl, lastFrameUrl: lastUrl,
          model,
          provider: (model === "veo-3.1-lite" || model === "veo-3.0" || model === "veo-3.0-fast") ? "veo" : "dashscope",
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setLastResult({
        id: data.runId,
        compiledPrompt: data.compiledPrompt,
        lastFrameDescription: data.lastFrameDescription,
      });
      const toastId = toast.loading("Генерация видео запущена…", { description: "Обычно занимает 30–120 секунд" });
      loadRuns();
      // Poll for completion
      const runId = data.runId as string;
      const startedAt = Date.now();
      const poll = async () => {
        const { data: row } = await supabase
          .from("wan_runs")
          .select("status, video_url, error_message")
          .eq("id", runId)
          .maybeSingle();
        if (!row) return;
        if (row.status === "completed") {
          toast.success("Видео готово", { id: toastId });
          loadRuns();
          return;
        }
        if (row.status === "failed") {
          toast.error(row.error_message || "Генерация не удалась", { id: toastId });
          loadRuns();
          return;
        }
        if (Date.now() - startedAt > 5 * 60 * 1000) {
          toast.error("Превышено ожидание 5 минут — проверьте историю позже", { id: toastId });
          loadRuns();
          return;
        }
        setTimeout(poll, 4000);
      };
      setTimeout(poll, 4000);
    } catch (e: any) {
      toast.error(e.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const restoreSetup = (s: WanSetup) => {
    setUserPrompt(s.userPrompt);
    setPresetId(s.presetId);
    setMotion(s.motion);
    setMood(s.mood);
    setOutput(s.output);
    setNegativePrompt(s.negativePrompt);
    setStyleStrength(s.styleStrength);
    setShowAdvanced(!!(s.negativePrompt || s.styleStrength !== 60 || s.output?.cameraFixed));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const copyPrompt = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Промпт скопирован");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Film size={20} className="text-primary" />
            <h2 className="font-display text-2xl font-light">AI Видео</h2>
            <span className="text-[10px] uppercase tracking-[0.2em] px-2 py-0.5 bg-primary/10 text-primary rounded">Бета</span>
          </div>
          <p className="text-sm text-muted-foreground max-w-xl">
            Премиум-генератор декор-видео (на движках DashScope WAN и Google Veo 3). Первый кадр задаёт начало ролика, Последний кадр используется как смысловой ориентир конечной композиции.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* LEFT: controls */}
        <div className="lg:col-span-2 space-y-5">
          {/* Prompt */}
          <div className="space-y-2">
            <Label className="text-[11px] uppercase tracking-[0.2em] font-semibold">Основной промпт</Label>
            <Textarea
              rows={4}
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              placeholder="напр. Свадебная арка в солнечном зале с каскадом цветов…"
              className="resize-none"
            />
            <div className="space-y-2 pt-1">
              <Label className="text-[11px] uppercase tracking-[0.2em] font-semibold text-muted-foreground">
                Шаблоны промтов · {VIDEO_PROMPT_TEMPLATES.length}
              </Label>
              <div className="flex gap-2 overflow-x-auto pb-2 snap-x -mx-1 px-1">
                {VIDEO_PROMPT_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setUserPrompt(t.prompt)}
                    className={cn(
                      "shrink-0 text-left rounded-lg border px-3 py-2 text-xs transition w-[170px]",
                      userPrompt === t.prompt
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-foreground/30 bg-card"
                    )}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Preset carousel */}
          <div className="space-y-2">
            <Label className="text-[11px] uppercase tracking-[0.2em] font-semibold">Стиль декора · 20</Label>
            <div className="flex gap-3 overflow-x-auto pb-3 snap-x -mx-1 px-1">
              {DECOR_PRESETS.map((p) => (
                <PresetCard key={p.id} preset={p} active={p.id === presetId} onClick={() => setPresetId(p.id)} />
              ))}
            </div>
          </div>

          {/* Motion */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[11px] uppercase tracking-[0.2em] font-semibold">Камера</Label>
              <Select value={motion.cameraId} onValueChange={(v) => setMotion({ ...motion, cameraId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MOTION_OPTIONS.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-[0.2em] font-semibold">Скорость</Label>
              <Select value={motion.speed} onValueChange={(v: any) => setMotion({ ...motion, speed: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SPEED_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Mood */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[11px] uppercase tracking-[0.2em] font-semibold">Настроение</Label>
              <Select value={mood.toneId} onValueChange={(v) => setMood({ ...mood, toneId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MOOD_OPTIONS.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-[0.2em] font-semibold">Освещение</Label>
              <Select value={mood.lightingId} onValueChange={(v) => setMood({ ...mood, lightingId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LIGHTING_OPTIONS.map((l) => <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Output */}
          <div>
            <Label className="text-[11px] uppercase tracking-[0.2em] font-semibold">Модель</Label>
            <Select value={model} onValueChange={(v: any) => setModel(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="veo-3.1-lite">Google Veo 3.1 Lite · быстро и экономно</SelectItem>
                <SelectItem value="veo-3.0">Google Veo 3.1 · максимум качества</SelectItem>
                <SelectItem value="veo-3.0-fast">Google Veo 3.1 Fast · быстрее</SelectItem>
                <SelectItem value="wan2.2-plus">Wan 2.2 plus · стабильная</SelectItem>
                <SelectItem value="wan2.5-preview">Wan 2.5 preview · новейшая</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground mt-1">
              Veo 3.1 (Google Gemini API) — реальное видео из текста или первого кадра. Lite — самый экономный вариант. Модели Wan работают через DashScope.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-[11px] uppercase tracking-[0.2em] font-semibold">Разрешение</Label>
              <Select value={output.resolution} onValueChange={(v: any) => setOutput({ ...output, resolution: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="480p">480p</SelectItem>
                  <SelectItem value="1080p">1080p</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-[0.2em] font-semibold">Формат</Label>
              <Select value={output.aspectRatio} onValueChange={(v: any) => setOutput({ ...output, aspectRatio: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["16:9","9:16","1:1","4:3","3:4","21:9"] as const).map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-[0.2em] font-semibold">Длительность</Label>
              <div className="grid grid-cols-4 gap-1">
                {([5, 6, 7, 8] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setOutput({ ...output, duration: d })}
                    className={cn(
                      "h-9 rounded-md border text-xs font-medium transition",
                      output.duration === d
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:border-foreground/40"
                    )}
                  >
                    {d}с
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Advanced */}
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
          >
            <ChevronDown size={14} className={cn("transition", showAdvanced && "rotate-180")} />
            Расширенные настройки
          </button>
          {showAdvanced && (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs">Сила стиля</Label>
                  <span className="text-xs text-muted-foreground">{styleStrength}%</span>
                </div>
                <Slider value={[styleStrength]} onValueChange={(v) => setStyleStrength(v[0])} min={0} max={100} step={5} />
              </div>
              <div>
                <Label className="text-xs">Негативный промпт</Label>
                <Textarea
                  rows={2}
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder="текст, логотипы, водяные знаки, искажённые лица…"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Фиксированная камера</Label>
                <Switch checked={output.cameraFixed} onCheckedChange={(v) => setOutput({ ...output, cameraFixed: v })} />
              </div>
            </div>
          )}

          {/* Generate */}
          <Button
            onClick={handleGenerate}
            disabled={generating || !userPrompt.trim()}
            size="lg"
            className="w-full text-[11px] uppercase tracking-[0.25em]"
          >
            {generating ? <Loader2 size={16} className="animate-spin mr-2" /> : <Wand2 size={16} className="mr-2" />}
            Сгенерировать видео
          </Button>
        </div>

        {/* RIGHT: Frame Lab + preview */}
        <div className="lg:col-span-3 space-y-5">
          <div className="border rounded-lg p-4 bg-card">
            <div className="flex items-center gap-2 mb-3">
              <ImageIcon size={14} className="text-primary" />
              <h3 className="font-semibold text-sm uppercase tracking-[0.2em]">Кадры</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FramePicker kind="first" file={firstFile} url={null} onPick={setFirstFile} onClear={() => setFirstFile(null)} />
              <FramePicker kind="last" file={lastFile} url={null} onPick={setLastFile} onClear={() => setLastFile(null)} />
            </div>
            <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
              <strong>Первый кадр</strong> анимируется напрямую (изображение → видео). <strong>Последний кадр</strong> анализируется vision-моделью и встраивается в промпт как смысловой ориентир финальной композиции.
            </p>
          </div>

          {/* Compiled preview */}
          <div className="border rounded-lg p-4 bg-muted/20">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-[11px] uppercase tracking-[0.2em] font-semibold">Собранный промпт</Label>
              <button onClick={() => copyPrompt(compiledPreview)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                <Copy size={12} /> Копировать
              </button>
            </div>
            <pre className="text-xs leading-relaxed whitespace-pre-wrap font-mono text-foreground/80 max-h-48 overflow-y-auto">
              {compiledPreview}
            </pre>
          </div>

          {/* Result */}
          {lastResult && (
            <div className="border-2 border-primary/40 rounded-lg p-4 bg-primary/5">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-primary" />
                <h3 className="font-semibold text-sm">Готовый бриф</h3>
              </div>
              {lastResult.lastFrameDescription && (
                <p className="text-xs text-muted-foreground mb-3">
                  <strong>Vision-анализ последнего кадра:</strong> {lastResult.lastFrameDescription}
                </p>
              )}
              <pre className="text-xs leading-relaxed whitespace-pre-wrap font-mono text-foreground/80 max-h-48 overflow-y-auto bg-background/60 p-3 rounded">
                {lastResult.compiledPrompt}
              </pre>
              <Button onClick={() => copyPrompt(lastResult.compiledPrompt)} size="sm" variant="outline" className="mt-3">
                <Copy size={12} className="mr-1" /> Скопировать промпт
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* History */}
      <div className="pt-6 border-t">
        <WanHistory
          runs={runs}
          loading={historyLoading}
          onRefresh={loadRuns}
          onRerun={(setup) => restoreSetup(setup)}
          onDelete={async (run) => {
            const { error } = await supabase.from("wan_runs").delete().eq("id", run.id);
            if (error) {
              toast.error(`Не удалось удалить: ${error.message}`);
              return;
            }
            setRuns((prev) => prev.filter((r) => r.id !== run.id));
            toast.success("Генерация удалена");
          }}
        />
      </div>

      {/* Floating AI prompt assistant */}
      <WanPromptChat
        onApplyPrompt={(p) => {
          setUserPrompt(p);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        context={{
          presetId,
          motion,
          mood,
          output,
          model,
          currentPrompt: userPrompt,
        }}
      />
    </div>
  );
};

export default AdminWanVideo;