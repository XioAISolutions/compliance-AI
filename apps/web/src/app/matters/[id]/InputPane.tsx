"use client";

/**
 * Input pane — always visible, compact.
 *
 * Shows the matter's scope (jurisdiction, registration, task) and a
 * document drop zone. Auto-classifies uploaded documents and shows them
 * as editable chips.
 */

import { useState } from "react";

interface MatterDocument {
  id: string;
  filename: string;
  documentType: string;
  chunkCount: number;
}

interface Matter {
  id: string;
  title: string;
  jurisdiction: string;
  registrationCategory: string;
  taskType: string;
  status: string;
}

const JURISDICTION_LABELS: Record<string, string> = {
  ontario: "Ontario",
  quebec: "Quebec",
  "british-columbia": "British Columbia",
  alberta: "Alberta",
  federal: "Federal",
};

const REGISTRATION_LABELS: Record<string, string> = {
  emd: "EMD",
  pm: "PM",
  iiroc: "IIROC (CIRO)",
  issuer: "Issuer",
  none: "N/A",
};

const TASK_LABELS: Record<string, string> = {
  "om-review": "Review offering memo",
  "kyc-gap-check": "KYC/AML gap check",
  "marketing-signoff": "Marketing sign-off",
  "response-memo": "Response memo",
};

const DOC_TYPE_LABELS: Record<string, string> = {
  "authority-rule": "Authority rule",
  "regulatory-guidance": "Regulatory guidance",
  "offering-memo": "Offering memo",
  "kyc-aml-file": "KYC/AML file",
  "marketing-material": "Marketing material",
  "reference-material": "Reference material",
  other: "Other",
};

interface Props {
  matter: Matter;
  documents: MatterDocument[];
  onDocumentUpload: (file: File) => Promise<void> | void;
}

export function InputPane({ matter, documents, onDocumentUpload }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState<string[]>([]);

  async function runUploads(files: File[]) {
    if (files.length === 0) return;
    setUploading((prev) => [...prev, ...files.map((f) => f.name)]);
    try {
      for (const file of files) {
        await onDocumentUpload(file);
      }
    } finally {
      setUploading((prev) => prev.filter((n) => !files.some((f) => f.name === n)));
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    void runUploads(Array.from(e.dataTransfer.files));
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    void runUploads(Array.from(e.target.files ?? []));
    // Reset input so re-selecting the same file re-triggers the handler
    e.target.value = "";
  }

  return (
    <div className="space-y-4">
      {/* Matter scope */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
          Matter scope
        </h2>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            {JURISDICTION_LABELS[matter.jurisdiction] ?? matter.jurisdiction}
          </span>
          <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700 dark:bg-purple-950 dark:text-purple-300">
            {REGISTRATION_LABELS[matter.registrationCategory] ?? matter.registrationCategory}
          </span>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            {TASK_LABELS[matter.taskType] ?? matter.taskType}
          </span>
        </div>
      </div>

      {/* Documents */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
          Documents
        </h2>
        {documents.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2 text-xs dark:border-neutral-800"
              >
                <span className="min-w-0 flex-1 truncate font-medium" title={doc.filename}>
                  {doc.filename}
                </span>
                <div className="ml-2 flex shrink-0 items-center gap-1.5">
                  {doc.chunkCount > 0 && (
                    <span className="text-[10px] text-neutral-400" title="Indexed chunks">
                      {doc.chunkCount} chunk{doc.chunkCount === 1 ? "" : "s"}
                    </span>
                  )}
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500 dark:bg-neutral-800">
                    {DOC_TYPE_LABELS[doc.documentType] ?? doc.documentType}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
        {uploading.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {uploading.map((name) => (
              <li
                key={name}
                className="flex items-center justify-between rounded-md border border-dashed border-blue-300 px-3 py-2 text-xs dark:border-blue-900"
              >
                <span className="min-w-0 flex-1 truncate">{name}</span>
                <span className="ml-2 animate-pulse text-[10px] text-blue-600 dark:text-blue-400">
                  parsing & chunking…
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Drop zone */}
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`mt-2 flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
            dragOver
              ? "border-blue-400 bg-blue-50 dark:border-blue-600 dark:bg-blue-950/30"
              : "border-neutral-300 hover:border-neutral-400 dark:border-neutral-700"
          }`}
        >
          <span className="text-sm text-neutral-500">
            Drop files here or{" "}
            <span className="font-medium text-neutral-700 dark:text-neutral-300">browse</span>
          </span>
          <span className="mt-1 text-xs text-neutral-400">PDF, DOCX, TXT</span>
          <input
            type="file"
            multiple
            accept=".pdf,.docx,.doc,.txt"
            onChange={handleFileSelect}
            className="hidden"
          />
        </label>
      </div>
    </div>
  );
}
