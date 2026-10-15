import {
	CodeEditor,
	type CodeEditorProps,
} from "@/components/ui/code-editor.js";

export type JsonEditorProps = Omit<CodeEditorProps, "language">;

export function JsonEditor(props: JsonEditorProps) {
	return <CodeEditor language="json" {...props} />;
}
