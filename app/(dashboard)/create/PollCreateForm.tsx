"use client";

import { useState, type ChangeEvent } from "react";
import { createPoll } from "@/app/lib/actions/poll-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function PollCreateForm() {
  const [options, setOptions] = useState(["", ""]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleOptionChange = (idx: number, value: string) => {
    setOptions((opts: string[]) => opts.map((opt: string, i: number) => (i === idx ? value : opt)));
  };

  const addOption = () => setOptions((opts: string[]) => [...opts, ""]);
  const removeOption = (idx: number) => {
    if (options.length > 2) {
      setOptions((opts: string[]) => opts.filter((_: string, i: number) => i !== idx));
    }
  };

  return (
    <form
      action={async (formData: FormData) => {
        setError(null);
        setSuccess(false);
        // Attach CSRF token from cookie
        try {
          const csrf = document.cookie.split('; ').find((c) => c.startsWith('csrfToken='))?.split('=')[1];
          if (csrf) {
            formData.set('csrfToken', csrf);
          }
        } catch {}
        const res = await createPoll(formData);
        if (res?.error) {
          setError(res.error);
        } else {
          setSuccess(true);
          setTimeout(() => {
            window.location.href = "/polls";
          }, 1200);
        }
      }}
      className="space-y-6 max-w-md mx-auto"
    >
      <div>
        <Label htmlFor="question">Poll Question</Label>
        <Input name="question" id="question" required />
      </div>
      <div>
        <Label>Options</Label>
        {options.map((opt, idx) => (
          <div key={idx} className="flex items-center gap-2 mb-2">
            <Input
              name="options"
              value={opt}
              onChange={(e: ChangeEvent<HTMLInputElement>) => handleOptionChange(idx, e.target.value)}
              required
            />
            {options.length > 2 && (
              <Button type="button" variant="destructive" onClick={() => removeOption(idx)}>
                Remove
              </Button>
            )}
          </div>
        ))}
        <Button type="button" onClick={addOption} variant="secondary">
          Add Option
        </Button>
      </div>
      {error && <div className="text-red-500">{error}</div>}
      {success && <div className="text-green-600">Poll created! Redirecting...</div>}
      <Button type="submit">Create Poll</Button>
    </form>
  );
} 