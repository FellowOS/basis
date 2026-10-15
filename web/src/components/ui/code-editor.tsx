import MonacoEditor from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useMemo } from "react";
import { useTheme } from "@/lib/theme.js";
import { cn } from "@/lib/utils.js";

const EXT_LANGUAGE: Record<string, string> = {
	json: "json",
	jsonc: "json",
	ts: "typescript",
	tsx: "typescript",
	mts: "typescript",
	cts: "typescript",
	js: "javascript",
	jsx: "javascript",
	mjs: "javascript",
	cjs: "javascript",
	md: "markdown",
	markdown: "markdown",
	html: "html",
	htm: "html",
	css: "css",
	scss: "scss",
	less: "less",
	py: "python",
	rs: "rust",
	go: "go",
	java: "java",
	c: "c",
	h: "c",
	cpp: "cpp",
	cc: "cpp",
	cxx: "cpp",
	hpp: "cpp",
	xml: "xml",
	yml: "yaml",
	yaml: "yaml",
	toml: "ini",
	sh: "shell",
	bash: "shell",
	zsh: "shell",
	sql: "sql",
	csv: "plaintext",
	txt: "plaintext",
	log: "plaintext",
};

export function monacoLanguageFromPath(filepath: string): string {
	const base = filepath.replace(/\\/g, "/").split("/").pop() ?? "";
	const dot = base.lastIndexOf(".");
	if (dot < 0) return "plaintext";
	return EXT_LANGUAGE[base.slice(dot + 1).toLowerCase()] ?? "plaintext";
}

export interface CodeEditorProps {
	value: string;
	onChange?: (value: string) => void;
	language?: string;
	height?: number | string;
	readOnly?: boolean;
	className?: string;
	/** Show bordered container (default true). */
	bordered?: boolean;
}

export function CodeEditor({
	value,
	onChange,
	language = "plaintext",
	height = 320,
	readOnly = false,
	className,
	bordered = true,
}: CodeEditorProps) {
	const { theme } = useTheme();
	const monacoTheme = theme === "dark" ? "vs-dark" : "vs";

	const options = useMemo(
		(): editor.IStandaloneEditorConstructionOptions => ({
			readOnly,
			minimap: { enabled: false },
			fontSize: 12,
			fontFamily:
				"ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
			lineNumbers: "on",
			scrollBeyondLastLine: false,
			automaticLayout: true,
			tabSize: 2,
			wordWrap: "on",
			formatOnPaste: !readOnly,
			scrollbar: {
				verticalScrollbarSize: 8,
				horizontalScrollbarSize: 8,
			},
			padding: { top: 8, bottom: 8 },
			domReadOnly: readOnly,
		}),
		[readOnly],
	);

	return (
		<div
			className={cn(
				"overflow-hidden bg-background",
				height === "100%" && "flex h-full min-h-0 flex-col",
				bordered && "rounded-md border border-border",
				className,
			)}
		>
			<MonacoEditor
				language={language}
				theme={monacoTheme}
				value={value}
				height={height}
				options={options}
				onChange={onChange ? (next) => onChange(next ?? "") : undefined}
			/>
		</div>
	);
}
