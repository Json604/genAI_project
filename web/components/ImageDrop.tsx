"use client";

import Image from "next/image";
import { useRef, useState, type ChangeEvent, type DragEvent } from "react";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

interface ImageDropProps {
  imageBase64: string | null;
  onImageChange: (imageBase64: string | null) => void;
}

export default function ImageDrop({ imageBase64, onImageChange }: ImageDropProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function readImage(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("INVALID FILE // IMAGE REQUIRED");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("FILE TOO LARGE // MAX 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const base64 = dataUrl.split(",")[1];
      if (!base64) {
        setError("IMAGE COULD NOT BE READ");
        return;
      }
      setPreview(dataUrl);
      setError(null);
      onImageChange(base64);
    };
    reader.onerror = () => setError("IMAGE COULD NOT BE READ");
    reader.readAsDataURL(file);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const [file] = Array.from(event.dataTransfer.files);
    if (file) readImage(file);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) readImage(file);
    event.target.value = "";
  }

  function removeImage() {
    setPreview(null);
    setError(null);
    onImageChange(null);
  }

  return (
    <div className="space-y-3">
      <input ref={inputRef} className="hidden" type="file" accept="image/*" onChange={handleFileChange} />
      <div
        className="flex min-h-52 cursor-pointer flex-col items-center justify-center gap-4 border-[3px] border-dashed border-ink p-5 text-center transition-colors hover:bg-accent"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
        }}
      >
        {imageBase64 && preview ? (
          <Image
            className="h-40 w-full object-contain"
            src={preview}
            alt="Uploaded search preview"
            width={640}
            height={320}
            unoptimized
          />
        ) : (
          <>
            <span className="text-4xl font-bold">＋</span>
            <span className="font-bold uppercase">DROP IMAGE / CLICK TO UPLOAD</span>
            <span className="text-xs font-bold">IMAGE FILES // 5MB MAX</span>
          </>
        )}
      </div>
      {imageBase64 ? (
        <button className="brut-button px-4 py-2 text-xs" type="button" onClick={removeImage}>
          REMOVE IMAGE
        </button>
      ) : null}
      {error ? <p className="border-[3px] border-ink bg-accent p-3 text-sm font-bold uppercase">{error}</p> : null}
    </div>
  );
}
