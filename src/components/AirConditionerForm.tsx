import { Action, ActionPanel, Form, Icon, useNavigation } from "@raycast/api";
import { useRef, useState } from "react";
import { AcFan, AcMode, AcSettings } from "../lib/types";

interface FormValues {
  mode: AcMode;
  temperature: string;
  fan: AcFan;
}

export default function AirConditionerForm({ onSubmit }: { onSubmit: (settings: AcSettings) => Promise<boolean> }) {
  const { pop } = useNavigation();
  const submittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(values: FormValues) {
    if (submittingRef.current) return false;
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const sent = await onSubmit({
        mode: values.mode,
        temperature: Number(values.temperature),
        fan: values.fan,
      });
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
      navigationTitle="運転内容を設定"
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={isSubmitting ? "IR信号を送信中" : "IR信号を送信"}
            icon={Icon.Snowflake}
            onSubmit={handleSubmit}
          />
        </ActionPanel>
      }
    >
      <Form.Dropdown id="mode" title="運転モード" defaultValue="cool">
        <Form.Dropdown.Item value="auto" title="自動" />
        <Form.Dropdown.Item value="cool" title="冷房" />
        <Form.Dropdown.Item value="dry" title="除湿" />
        <Form.Dropdown.Item value="fan" title="送風" />
        <Form.Dropdown.Item value="heat" title="暖房" />
      </Form.Dropdown>
      <Form.Dropdown id="temperature" title="設定温度" defaultValue="26">
        {Array.from({ length: 15 }, (_, index) => 16 + index).map((temperature) => (
          <Form.Dropdown.Item key={temperature} value={String(temperature)} title={`${temperature}℃`} />
        ))}
      </Form.Dropdown>
      <Form.Dropdown id="fan" title="風量" defaultValue="auto">
        <Form.Dropdown.Item value="auto" title="自動" />
        <Form.Dropdown.Item value="low" title="弱" />
        <Form.Dropdown.Item value="mid" title="中" />
        <Form.Dropdown.Item value="high" title="強" />
      </Form.Dropdown>
    </Form>
  );
}
