import { Action, ActionPanel, Form, Icon, showToast, Toast, useNavigation } from "@raycast/api";
import { useRef, useState } from "react";

interface FormValues {
  channel: string;
}

export default function TelevisionChannelForm({ onSubmit }: { onSubmit: (channel: string) => Promise<boolean> }) {
  const { pop } = useNavigation();
  const submittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(values: FormValues) {
    if (submittingRef.current) return false;
    const channel = values.channel.trim();
    if (!/^\d{1,3}$/.test(channel) || Number(channel) < 1 || Number(channel) > 999) {
      await showToast({
        style: Toast.Style.Failure,
        title: "チャンネルを確認してください",
        message: "1〜999の整数を入力してください。",
      });
      return false;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const sent = await onSubmit(String(Number(channel)));
      if (sent) pop();
      return sent;
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <Form
      isLoading={isSubmitting}
      navigationTitle="チャンネル指定"
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={isSubmitting ? "IR信号を送信中" : "CHを送信"}
            icon={Icon.Hashtag}
            onSubmit={handleSubmit}
          />
        </ActionPanel>
      }
    >
      <Form.TextField id="channel" title="チャンネル" placeholder="1〜999" autoFocus />
      <Form.Description text="IR信号を送信します。テレビの実機状態や選局結果は確認できません。" />
    </Form>
  );
}
