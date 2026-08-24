import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';

export type ReportTarget = {
  userId: number;
  name: string;
  channelId?: number | null;
  messageId?: number | null;
  quote?: string | null;
};

export function ReportDialog({
  target,
  onClose,
}: {
  target: ReportTarget | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (target) setReason('');
  }, [target]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!target) return;
      await apiRequest('POST', '/api/reports', {
        targetUserId: target.userId,
        channelId: target.channelId ?? null,
        messageId: target.messageId ?? null,
        reason: reason.trim(),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['/api/admin/reports'] });
      void queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      onClose();
      toast({
        title: 'Report sent to the admins',
        description: 'They can see the message and the channel it came from.',
      });
    },
    onError: (error: Error) =>
      toast({ title: 'Could not send report', description: error.message, variant: 'destructive' }),
  });

  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report {target?.name}</DialogTitle>
          <DialogDescription>
            An admin reviews every report. Nothing happens to the member until a human decides.
          </DialogDescription>
        </DialogHeader>

        {target?.quote && (
          <blockquote className="rounded-md border-l-2 border-primary bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            {target.quote}
          </blockquote>
        )}

        <div className="space-y-2">
          <label htmlFor="report-reason" className="text-sm font-medium">
            What happened?
          </label>
          <Textarea
            id="report-reason"
            rows={4}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Describe the behaviour, not the person."
            data-testid="input-report-reason"
          />
          <p className="text-xs text-muted-foreground">{reason.length}/280 characters</p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={reason.trim().length < 4 || mutation.isPending}
            data-testid="button-submit-report"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Send report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
