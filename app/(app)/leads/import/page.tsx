"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Mail, ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: number; details: any[] } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    setResult(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/v1/leads/import", {
        method: "POST",
        headers: {
          "X-Tenant-Id": "default-tenant-id",
        },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data);
      } else {
        const error = await res.json();
        alert(error.error?.message || "Import failed");
      }
    } catch {
      alert("Something went wrong");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/leads" className="text-primary hover:underline">
          <ArrowLeft className="h-4 w-4 mr-1" /> Leads
        </Link>
        <span className="mx-2">/</span>
        <span>Import CSV</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Import Leads from CSV</CardTitle>
          <p className="text-sm text-muted-foreground">
            Upload a CSV file with columns: name, email, phone, company, website, industry, location, requirement
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex flex-col items-center gap-3">
              <Upload className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium">
                {file ? file.name : "Click to upload or drag and drop"}
              </p>
              <p className="text-xs text-muted-foreground">
                CSV, XLSX, XLS files
              </p>
            </div>
            <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileChange} className="hidden" />
          </div>

          {result && (
            <Card className="border border-green/20 bg-green/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle>Import Complete</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Imported</p>
                    <p className="text-lg font-semibold text-green">{result.imported}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Errors</p>
                    <p className="text-lg font-semibold text-destructive">
                      {result.errors}
                    </p>
                  </div>
                </div>
                {result.details && result.details.length > 0 && (
                  <div className="mt-4 max-h-48 overflow-y-auto text-sm">
                    <p className="text-xs font-semibold mb-2">Error Details:</p>
                    <ul className="space-y-1">
                      {result.details.map((d, i) => (
                        <li key={i} className="text-destructive">
                          Row {d.row}: {d.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="flex items-center justify-between">
            <Link href="/leads" className="text-sm text-muted-foreground hover:underline">
              Cancel
            </Link>
            <Button
              type="button"
              disabled={!file || uploading}
              onClick={handleSubmit}
            >
              {uploading ? "Importing..." : "Start Import"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
