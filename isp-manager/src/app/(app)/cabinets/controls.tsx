"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { addPoleAction, removePoleAction } from "./actions";

/** Admin: add a pole by number. */
export function AddPoleForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await addPoleAction(name);
      if (res.ok) {
        toast.success(res.message);
        setName("");
        router.refresh();
      } else toast.error(res.error);
    });
  };
  return (
    <form onSubmit={submit} className="mb-4 flex gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="رقم عامود جديد، مثلاً 51"
        inputMode="numeric"
        autoComplete="off"
        className="h-11"
      />
      <Button type="submit" className="h-11 shrink-0" disabled={pending || name.trim() === ""}>
        {pending ? <Loader2 className="animate-spin" /> : <Plus />} إضافة عامود
      </Button>
    </form>
  );
}

/** Admin: remove an empty pole (hides the card only). */
export function RemovePoleButton({ pole }: { pole: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const submit = () =>
    startTransition(async () => {
      setError(undefined);
      const res = await removePoleAction(pole);
      if (res.ok) {
        toast.success(res.message);
        setOpen(false);
        router.refresh();
      } else setError(res.error);
    });
  return (
    <>
      <button
        type="button"
        aria-label={`حذف عامود ${pole}`}
        className="absolute top-2 left-2 rounded-md p-1.5 text-muted-foreground hover:bg-danger/10 hover:text-danger"
        onClick={() => {
          setError(undefined);
          setOpen(true);
        }}
      >
        <Trash2 className="size-4" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>حذف عامود {pole}؟</DialogTitle>
            <DialogDescription>
              يختفي العامود من «الكابينات» فقط. لا يتأثر أي مشترك ولا أي بيانات، ويمكنك إرجاعه في أي وقت من «إضافة عامود».
            </DialogDescription>
          </DialogHeader>
          {error && <Alert variant="destructive">{error}</Alert>}
          <Button variant="destructive" size="lg" className="h-12" disabled={pending} onClick={submit}>
            {pending ? <Loader2 className="animate-spin" /> : <Trash2 />} حذف العامود
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
