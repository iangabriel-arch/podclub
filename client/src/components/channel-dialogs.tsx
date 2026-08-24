import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { channelFormSchema, TOPICS } from '@shared/schema';
import type { ChannelForm, ChannelWithMeta } from '@shared/schema';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CoverArt } from '@/components/brand';
import { Check, Copy, Link2, Loader2 } from 'lucide-react';

function invalidateChannels() {
  void queryClient.invalidateQueries({ queryKey: ['/api/channels'] });
  void queryClient.invalidateQueries({ queryKey: ['/api/channels/discover'] });
  void queryClient.invalidateQueries({ queryKey: ['/api/admin/channels'] });
  void queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
}

/* ------------------------------ create channel ---------------------------- */

export function CreateChannelDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const form = useForm<ChannelForm>({
    resolver: zodResolver(channelFormSchema),
    defaultValues: { name: '', description: '', topic: 'Music' },
  });

  useEffect(() => {
    if (open) form.reset({ name: '', description: '', topic: 'Music' });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = useMutation({
    mutationFn: async (values: ChannelForm) => {
      const res = await apiRequest('POST', '/api/channels', values);
      return (await res.json()) as ChannelWithMeta;
    },
    onSuccess: (channel) => {
      invalidateChannels();
      onOpenChange(false);
      toast({ title: `${channel.name} is live`, description: 'Share the invite link to fill the room.' });
      navigate(`/channels/${channel.id}`);
    },
    onError: (error: Error) =>
      toast({ title: 'Could not create channel', description: error.message, variant: 'destructive' }),
  });

  const name = form.watch('name');
  const topic = form.watch('topic');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Start a listening room</DialogTitle>
          <DialogDescription>
            You can host up to five at a time. Artwork is generated from the name.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 rounded-lg border border-card-border bg-card p-4">
          <CoverArt seed={`${name}${topic}`} topic={topic} className="h-16 w-16 shrink-0 rounded-lg" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{name || 'Untitled room'}</p>
            <p className="text-xs text-muted-foreground">{topic}</p>
          </div>
        </div>

        <Form {...form}>
          <form
            id="create-channel-form"
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Channel name</FormLabel>
                  <FormControl>
                    <Input placeholder="Sunday Morning Jazz" data-testid="input-channel-name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="topic"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Topic</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-channel-topic">
                        <SelectValue placeholder="Choose a topic" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TOPICS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="What is this room for, and how should people behave in it?"
                      data-testid="input-channel-description"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>{(field.value ?? '').length}/280 characters</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-channel-form"
            disabled={mutation.isPending}
            data-testid="button-submit-channel"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create channel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------- edit channel ----------------------------- */

export function EditChannelDialog({
  channel,
  open,
  onOpenChange,
}: {
  channel: ChannelWithMeta;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();

  const form = useForm<ChannelForm>({
    resolver: zodResolver(channelFormSchema),
    defaultValues: { name: channel.name, description: channel.description, topic: channel.topic },
  });

  useEffect(() => {
    if (open) {
      form.reset({ name: channel.name, description: channel.description, topic: channel.topic });
    }
  }, [open, channel.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = useMutation({
    mutationFn: async (values: ChannelForm) => {
      const res = await apiRequest('PATCH', `/api/channels/${channel.id}`, values);
      return (await res.json()) as ChannelWithMeta;
    },
    onSuccess: () => {
      invalidateChannels();
      void queryClient.invalidateQueries({ queryKey: ['/api/channels', channel.id] });
      onOpenChange(false);
      toast({ title: 'Channel updated' });
    },
    onError: (error: Error) =>
      toast({ title: 'Could not update channel', description: error.message, variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit channel</DialogTitle>
          <DialogDescription>Members see these changes immediately.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="edit-channel-form"
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Channel name</FormLabel>
                  <FormControl>
                    <Input data-testid="input-edit-name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="topic"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Topic</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-edit-topic">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TOPICS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea rows={4} data-testid="input-edit-description" {...field} />
                  </FormControl>
                  <FormDescription>{(field.value ?? '').length}/280 characters</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-channel-form"
            disabled={mutation.isPending}
            data-testid="button-save-channel"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ delete channel ---------------------------- */

export function DeleteChannelDialog({
  channel,
  open,
  onOpenChange,
  onDeleted,
}: {
  channel: ChannelWithMeta;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: () => apiRequest('DELETE', `/api/channels/${channel.id}`),
    onSuccess: () => {
      invalidateChannels();
      onOpenChange(false);
      toast({ title: `${channel.name} deleted` });
      onDeleted?.();
    },
    onError: (error: Error) =>
      toast({ title: 'Could not delete channel', description: error.message, variant: 'destructive' }),
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{channel.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the room, its {channel.messageCount} messages and all{' '}
            {channel.memberCount} memberships. It cannot be undone, and it frees up one of your five
            channel slots.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep channel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              mutation.mutate();
            }}
            className="bg-destructive text-destructive-foreground"
            data-testid="button-confirm-delete-channel"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* -------------------------------- invite link ----------------------------- */

export function InviteDialog({
  channel,
  open,
  onOpenChange,
}: {
  channel: ChannelWithMeta;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const link = `${window.location.origin}${window.location.pathname}#/invite/${channel.inviteCode}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      toast({
        title: 'Copy the link manually',
        description: 'Clipboard access is blocked here. Select the link and copy it.',
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite people to {channel.name}</DialogTitle>
          <DialogDescription>
            Anyone with this link can join the room. Send it only to people you want in the
            conversation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-muted/40 px-3 py-2">
              <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate font-mono text-xs" data-testid="text-invite-link">
                {link}
              </span>
            </div>
            <Button onClick={copy} className="shrink-0" data-testid="button-copy-invite">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Invite code <code className="font-mono text-foreground">{channel.inviteCode}</code> — the
            link stays valid until you delete the channel.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
