import { ExternalLink, FileText, Lightbulb, MessageSquareText, Quote, Target } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { MediaAsset, Video } from "@/lib/learner/types";

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function words(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function safeUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch { return null; }
}

function StringList({ values }: { values: unknown[] }) {
  const strings = values.filter((value): value is string => typeof value === "string");
  if (!strings.length) return null;
  return <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-muted-foreground">{strings.map((value, index) => <li key={`${value}-${index}`} className="pl-1 text-sm leading-6 text-muted-foreground">{value}</li>)}</ul>;
}

function BlockBody({ heading, body, equation, items, index }: { heading?: string; body?: string; equation: string | null; items: unknown[]; index: number }) {
  return (
    <>
      {heading && <h3 id={`content-block-${index}`} className="font-medium">{heading}</h3>}
      {body && <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{body}</p>}
      {equation && <div className="overflow-x-auto rounded-lg bg-foreground px-4 py-3 font-mono text-sm text-background" aria-label="Mathematical expression">{equation}</div>}
      {items.length > 0 && <StringList values={items} />}
    </>
  );
}

function ContentBlock({ value, index }: { value: unknown; index: number }) {
  if (typeof value === "string") return <p className="text-sm leading-7 text-muted-foreground">{value}</p>;
  const block = record(value);
  if (!block) return null;
  const heading = [block.heading, block.title, block.label].find((item) => typeof item === "string") as string | undefined;
  const body = [block.body, block.text, block.copy, block.description, block.content].find((item) => typeof item === "string") as string | undefined;
  const equation = typeof block.equation === "string" ? block.equation : block.type === "equation" && typeof block.value === "string" ? block.value : null;
  const items = Array.isArray(block.items) ? block.items : [];
  const type = typeof block.type === "string" ? block.type.toLowerCase() : "";
  if (!heading && !body && !equation && !items.length) return null;

  if (type.includes("callout") || type.includes("tip")) {
    return (
      <Alert aria-labelledby={heading ? `content-block-${index}` : undefined}>
        <Lightbulb />
        {heading && <AlertTitle id={`content-block-${index}`}>{heading}</AlertTitle>}
        <AlertDescription className="flex flex-col gap-3">
          {body && <p className="whitespace-pre-wrap leading-7">{body}</p>}
          {equation && <div className="overflow-x-auto rounded-lg bg-foreground px-4 py-3 font-mono text-sm text-background" aria-label="Mathematical expression">{equation}</div>}
          {items.length > 0 && <StringList values={items} />}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <section className="flex flex-col gap-2.5" aria-labelledby={heading ? `content-block-${index}` : undefined}>
      <BlockBody heading={heading} body={body} equation={equation} items={items} index={index} />
    </section>
  );
}

export function ContentRenderer({ content }: { content: Record<string, unknown> | null | undefined }) {
  if (!content || !Object.keys(content).length) return null;
  const source = record(content.source);
  const facilitation = record(content.facilitation);
  const blocks = Array.isArray(content.blocks) ? content.blocks : [];
  const sourceUrl = safeUrl(source?.url);
  const reserved = new Set(["source", "facilitation", "blocks", "chapter", "section"]);
  const generic = Object.entries(content).filter(([key]) => !reserved.has(key));

  return (
    <div className="flex flex-col gap-6">
      {blocks.map((block, index) => <ContentBlock key={index} value={block} index={index} />)}

      {facilitation && (
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { key: "prompt", label: "Your task", icon: Target },
            { key: "deliverable", label: "What to produce", icon: FileText },
            { key: "reflection", label: "Reflect", icon: Lightbulb },
          ].map(({ key, label, icon: Icon }) => typeof facilitation[key] === "string" && (
            <Card key={key} size="sm">
              <CardHeader>
                <CardTitle>{label}</CardTitle>
                <CardAction><Icon className="size-4 text-muted-foreground" aria-hidden="true" /></CardAction>
              </CardHeader>
              <CardContent><p className="text-xs leading-5 text-muted-foreground">{String(facilitation[key])}</p></CardContent>
            </Card>
          ))}
        </div>
      )}

      {generic.map(([key, value], index) => {
        if (typeof value === "string") return <section key={key} className="flex flex-col gap-2"><h3 className="font-medium">{words(key)}</h3><p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{value}</p></section>;
        if (Array.isArray(value)) return <section key={key} className="flex flex-col gap-3"><h3 className="font-medium">{words(key)}</h3><StringList values={value} /></section>;
        return <ContentBlock key={key} value={value} index={blocks.length + index} />;
      })}

      {source && Boolean(source.title || source.creator || sourceUrl) && (
        <Card size="sm">
          <CardHeader>
            <span className="mb-1 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Quote className="size-3.5" aria-hidden="true" />
              Related source
            </span>
            <CardTitle>{String(source.title || "Learning resource")}</CardTitle>
            {typeof source.creator === "string" && <CardDescription>{source.creator}</CardDescription>}
            {sourceUrl && <CardAction><Button asChild variant="outline" size="sm"><a href={sourceUrl} target="_blank" rel="noreferrer">Open source<ExternalLink data-icon="inline-end" /></a></Button></CardAction>}
          </CardHeader>
        </Card>
      )}
    </div>
  );
}

function youtubeEmbed(value: string) {
  try {
    const url = new URL(value);
    let id = "";
    if (url.hostname === "youtu.be") id = url.pathname.slice(1);
    if (url.hostname.includes("youtube.com")) id = url.searchParams.get("v") || (url.pathname.startsWith("/embed/") ? url.pathname.split("/")[2] : "");
    return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null;
  } catch { return null; }
}

export function VideoRenderer({ video, media, onEnded }: { video: Video; media?: MediaAsset; onEnded?: () => void }) {
  const url = media ? safeUrl(media.public_url || media.cdn_url) : null;
  const embed = url ? youtubeEmbed(url) : null;
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-xl bg-foreground shadow-sm">
        {embed ? (
          <iframe src={embed} title={video.title} className="aspect-video w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        ) : url && media?.mime_type.startsWith("video/") ? (
          <video src={url} controls className="aspect-video w-full bg-black" onEnded={onEnded}>Your browser does not support embedded video.</video>
        ) : (
          <div className="grid aspect-video place-items-center px-6 text-center text-background">
            <div className="flex max-w-sm flex-col items-center gap-4">
              <MessageSquareText className="size-6" />
              <p className="text-sm">This video opens as an external learning resource.</p>
              {url && <Button asChild variant="secondary"><a href={url} target="_blank" rel="noreferrer">Open video<ExternalLink data-icon="inline-end" /></a></Button>}
            </div>
          </div>
        )}
      </div>
      {(video.title || video.description) && <div className="flex flex-col gap-1.5"><h2 className="text-lg font-semibold tracking-tight">{video.title}</h2>{video.description && <p className="text-sm leading-6 text-muted-foreground">{video.description}</p>}</div>}
      {video.transcript && (
        <details className="group rounded-xl border bg-card">
          <summary className="learner-pressable cursor-pointer list-none px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">Read transcript</summary>
          <Separator />
          <p className="whitespace-pre-wrap px-4 py-4 text-sm leading-7 text-muted-foreground">{video.transcript}</p>
        </details>
      )}
    </div>
  );
}
