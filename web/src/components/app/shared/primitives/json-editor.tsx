import {
	CodeEditor,
	type CodeEditorProps,
} from "@/components/app/shared/primitives/code-editor.js";

export type JsonEditorProps = Omit<CodeEditorProps, "language">;

export function JsonEditor(props: JsonEditorProps) {
	return <CodeEditor language="json" {...props} />;
}
