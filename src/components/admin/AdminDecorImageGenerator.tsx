import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Sparkles, Loader2, Image as ImageIcon, Copy, Wand2, Download, Check,
  Upload, X, PencilRuler,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { IMAGE_PROMPT_TEMPLATES, type DecorPromptTemplate } from "@/data/decorPromptTemplates";

const ASPECT_RATIOS = [
  { value: "16:9", label: "16:9 — Горизонтально" },
  { value: "1:1", label: "1:1 — Квадрат" },
  { value: "9:16", label: "9:16 — Вертикально" },
  { value: "4:3", label: "4:3 — Классика" },
  { value: "3:4", label: "3:4 — Портрет" },
];

type Mode = "generate" | "edit";

const AdminDecorImageGenerator = () => {
  const [mode, setMode] = useState<Mode>("generate");
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [generating, setGenerating] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Edit mode: uploaded source image
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const applyTemplate = (t: DecorPromptTemplate) => {
    setPrompt(t.prompt);
    setResultUrl(null);
  };

  const onFile = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Загрузите изображение");
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      toast.error("Фото должно быть меньше 8 МБ");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSourceImage(reader.result as string);
      setResultUrl(null);
      toast.success("✅ Изображение загружено");
    };
    reader.readAsDataURL(f);
  };

  const generate = async () => {
    if (!prompt.trim()) {
      toast.error("Введите промпт");
      return;
    }
    setGenerating(true);
    setResultUrl(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-decor-image", {
        body: { prompt: prompt.trim(), aspectRatio },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.message || data.error);
      if (!data?.image) throw new Error("Пустой ответ от модели");
      setResultUrl(data.image);
      setModel(data.model || null);
      toast.success("✨ Изображение сгенерировано!");
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (e: any) {
      toast.error(e.message || "Ошибка генерации");
    } finally {
      setGenerating(false);
    }
  };

  const edit = async () => {
    if (!prompt.trim()) {
      toast.error("Введите промпт с изменениями");
      return;
    }
    if (!sourceImage) {
      toast.error("Сначала загрузите изображение");
      return;
    }
    setGenerating(true);
    setResultUrl(null);
    try {
      const { data, error } = await supabase.functions.invoke("edit-decor-image", {
        body: { prompt: prompt.trim(), image: sourceImage, aspectRatio },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.message || data.error);
      if (!data?.image) throw new Error("Пустой ответ от модели");
      setResultUrl(data.image);
      setModel(data.model || null);
      toast.success("✨ Изображение отредактировано!");
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (e: any) {
      toast.error(e.message || "Ошибка редактирования");
    } finally {
      setGenerating(false);
    }
  };

  const copyPrompt = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Промпт скопирован");
  };

  const downloadImage = () => {
    if (!resultUrl) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = `decor-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ImageIcon size={20} className="text-primary" />
            <h2 className="font-display text-2xl font-light">AI Генерация изображения</h2>
          </div>
          <p className="text-sm text-muted-foreground max-w-xl">
            Генератор декора на основе Google Gemini. Создавайте изображение с нуля или загрузите фото и редактируйте его.
          </p>
        </div>

        {/* Mode switch */}
        <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
          <button
            onClick={() => { setMode("generate"); setResultUrl(null); }}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-semibold transition",
              mode === "generate" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
            )}
          >
            <Wand2 size={13} className="inline mr-1" /> С нуля
          </button>
          <button
            onClick={() => { setMode("edit"); setResultUrl(null); }}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-semibold transition",
              mode === "edit" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
            )}
          >
            <PencilRuler size={13} className="inline mr-1" /> Редактировать фото
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* LEFT: controls */}
        <div className="lg:col-span-2 space-y-5">
          {/* Edit mode: upload source */}
          {mode === "edit" && (
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-[0.2em] font-semibold">
                Исходное изображение
              </Label>
              {sourceImage ? (
                <div className="relative border rounded-lg overflow-hidden">
                  <img src={sourceImage} alt="Source" className="w-full object-contain max-h-56 bg-muted/30" />
                  <button
                    onClick={() => { setSourceImage(null); setResultUrl(null); }}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files?.[0] ?? null); }}
                  className="border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center gap-2 cursor-pointer hover:bg-muted/40 transition"
                >
                  <Upload size={24} className="text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Нажмите или перетащите фото</p>
                  <p className="text-[11px] text-muted-foreground/70">PNG, JPG до 8 МБ</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { onFile(e.target.files?.[0] ?? null); e.target.value = ""; }}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-[11px] uppercase tracking-[0.2em] font-semibold">
              {mode === "edit" ? "Что изменить на фото" : "Промпт"}
            </Label>
            <Textarea
              rows={6}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                mode === "edit"
                  ? "Например: «Замени арку на композицию из белых пионов, добавь золотые свечи…»"
                  : "Опишите декор… или выберите шаблон ниже"
              }
              className="resize-none"
            />
            <button
              onClick={copyPrompt}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              disabled={!prompt.trim()}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />} Копировать промпт
            </button>
          </div>

          <div>
            <Label className="text-[11px] uppercase tracking-[0.2em] font-semibold">Формат</Label>
            <Select value={aspectRatio} onValueChange={setAspectRatio}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ASPECT_RATIOS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Templates — only in generate mode */}
          {mode === "generate" && (
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-[0.2em] font-semibold">
                Шаблоны промтов · {IMAGE_PROMPT_TEMPLATES.length}
              </Label>
              <div className="flex gap-2 overflow-x-auto pb-2 snap-x -mx-1 px-1 max-h-48 overflow-y-auto flex-wrap content-start">
                {IMAGE_PROMPT_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => applyTemplate(t)}
                    className={cn(
                      "shrink-0 text-left rounded-lg border px-3 py-2 text-xs transition w-[170px]",
                      prompt === t.prompt
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-foreground/30 bg-card"
                    )}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Button
            onClick={mode === "edit" ? edit : generate}
            disabled={generating || !prompt.trim() || (mode === "edit" && !sourceImage)}
            size="lg"
            className="w-full text-[11px] uppercase tracking-[0.25em]"
          >
            {generating ? <Loader2 size={16} className="animate-spin mr-2" /> : (mode === "edit" ? <PencilRuler size={16} className="mr-2" /> : <Wand2 size={16} className="mr-2" />)}
            {mode === "edit" ? "Применить изменения" : "Сгенерировать изображение"}
          </Button>
        </div>

        {/* RIGHT: result */}
        <div className="lg:col-span-3" ref={scrollRef}>
          <div className="border rounded-lg p-4 bg-card min-h-[420px] flex items-center justify-center">
            {generating ? (
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Loader2 size={32} className="animate-spin text-primary" />
                <p className="text-sm">{mode === "edit" ? "Редактирование изображения…" : "Генерация изображения…"}</p>
              </div>
            ) : resultUrl ? (
              <div className="w-full">
                <img
                  src={resultUrl}
                  alt="Result"
                  className="w-full rounded-lg object-contain max-h-[560px]"
                />
                <div className="flex items-center justify-between mt-3">
                  <span className="text-[11px] text-muted-foreground">Модель: {model || "—"}</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={downloadImage}>
                      <Download size={14} className="mr-1" /> Скачать
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Sparkles size={32} />
                <p className="text-sm">{mode === "edit" ? "Результат редактирования появится здесь" : "Результат появится здесь"}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDecorImageGenerator;
