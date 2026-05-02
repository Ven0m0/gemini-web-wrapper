import { describe, expect, it } from "bun:test";
import {
	convertToOpenAIMessages,
	convertToOpenAITools,
	parseAssistantMessage,
} from "./utils.js";
import type { Message, Tool } from "@/foundation";

describe("convertToOpenAIMessages", () => {
	it("should convert system messages", () => {
		const messages: Message[] = [
			{
				role: "system",
				content: [{ type: "text", text: "You are a helpful assistant." }],
			},
		];
		const result = convertToOpenAIMessages(messages);
		expect(result).toEqual([
			{ role: "system", content: "You are a helpful assistant." },
		]);
	});

	it("should convert user messages with single text content", () => {
		const messages: Message[] = [
			{ role: "user", content: [{ type: "text", text: "Hello" }] },
		];
		const result = convertToOpenAIMessages(messages);
		expect(result).toEqual([{ role: "user", content: "Hello" }]);
	});

	it("should convert user messages with multiple text/image contents", () => {
		const messages: Message[] = [
			{
				role: "user",
				content: [
					{ type: "text", text: "What is this image?" },
					{
						type: "image_url",
						image_url: { url: "https://example.com/image.png" },
					},
				],
			},
		];
		const result = convertToOpenAIMessages(messages);
		expect(result).toEqual([
			{
				role: "user",
				content: [
					{ type: "text", text: "What is this image?" },
					{
						type: "image_url",
						image_url: { url: "https://example.com/image.png" },
					},
				],
			},
		]);
	});

	it("should convert assistant messages with text", () => {
		const messages: Message[] = [
			{ role: "assistant", content: [{ type: "text", text: "Hi there" }] },
		];
		const result = convertToOpenAIMessages(messages);
		expect(result).toEqual([{ role: "assistant", content: "Hi there" }]);
	});

	it("should convert assistant messages with tool calls", () => {
		const messages: Message[] = [
			{
				role: "assistant",
				content: [
					{
						type: "tool_use",
						id: "call_123",
						name: "getWeather",
						input: { location: "Tokyo" },
					},
				],
			},
		];
		const result = convertToOpenAIMessages(messages);
		expect(result).toEqual([
			{
				role: "assistant",
				tool_calls: [
					{
						type: "function",
						id: "call_123",
						function: { name: "getWeather", arguments: '{"location":"Tokyo"}' },
					},
				],
			},
		]);
	});

	it("should convert assistant messages with text and tool calls", () => {
		const messages: Message[] = [
			{
				role: "assistant",
				content: [
					{ type: "text", text: "Let me check the weather." },
					{
						type: "tool_use",
						id: "call_123",
						name: "getWeather",
						input: { location: "Tokyo" },
					},
				],
			},
		];
		const result = convertToOpenAIMessages(messages);
		expect(result).toEqual([
			{
				role: "assistant",
				content: "Let me check the weather.",
				tool_calls: [
					{
						type: "function",
						id: "call_123",
						function: { name: "getWeather", arguments: '{"location":"Tokyo"}' },
					},
				],
			},
		]);
	});

	it("should convert assistant messages with empty content", () => {
		const messages: Message[] = [{ role: "assistant", content: [] }];
		const result = convertToOpenAIMessages(messages);
		expect(result).toEqual([{ role: "assistant", content: null }]);
	});

	it("should convert tool messages", () => {
		const messages: Message[] = [
			{
				role: "tool",
				content: [
					{
						type: "tool_result",
						tool_use_id: "call_123",
						content: "Sunny, 25C",
					},
				],
			},
		];
		const result = convertToOpenAIMessages(messages);
		expect(result).toEqual([
			{ role: "tool", tool_call_id: "call_123", content: "Sunny, 25C" },
		]);
	});
});

describe("convertToOpenAITools", () => {
	it("should convert tools with schema properties", () => {
		const tools = [
			{
				name: "getWeather",
				description: "Get the weather",
				parameters: { _def: { shape: { location: { type: "string" } } } },
			},
		];
		// Cast any to bypass generic limitations for simple test
		const result = convertToOpenAITools(tools as any);
		expect(result).toEqual([
			{
				type: "function",
				function: {
					name: "getWeather",
					description: "Get the weather",
					parameters: {
						type: "object",
						properties: { location: { type: "string" } },
					},
				},
			},
		]);
	});

	it("should convert tools without schema properties", () => {
		const tools = [
			{
				name: "ping",
				description: "Ping the server",
				parameters: { _def: {} },
			},
		];
		const result = convertToOpenAITools(tools as any);
		expect(result).toEqual([
			{
				type: "function",
				function: {
					name: "ping",
					description: "Ping the server",
					parameters: {},
				},
			},
		]);
	});
});

describe("parseAssistantMessage", () => {
	it("should parse text content", () => {
		const result = parseAssistantMessage({ content: "Hello world" });
		expect(result.role).toBe("assistant");
		expect(result.content).toEqual([{ type: "text", text: "Hello world" }]);
		expect(result.usage).toBeUndefined();
	});

	it("should parse tool calls with valid JSON", () => {
		const result = parseAssistantMessage({
			tool_calls: [
				{
					id: "call_123",
					function: { name: "getWeather", arguments: '{"location":"Tokyo"}' },
				},
			],
		});
		expect(result.role).toBe("assistant");
		expect(result.content).toEqual([
			{
				type: "tool_use",
				id: "call_123",
				name: "getWeather",
				input: { location: "Tokyo" },
			},
		]);
	});

	it("should parse tool calls with invalid JSON", () => {
		const result = parseAssistantMessage({
			tool_calls: [
				{
					id: "call_123",
					function: { name: "getWeather", arguments: '{"location":Tokyo}' },
				},
			],
		});
		expect(result.role).toBe("assistant");
		expect(result.content).toEqual([
			{
				type: "tool_use",
				id: "call_123",
				name: "getWeather",
				input: { raw: '{"location":Tokyo}' },
			},
		]);
	});

	it("should parse combined text and tool calls", () => {
		const result = parseAssistantMessage({
			content: "Let me check.",
			tool_calls: [
				{
					id: "call_123",
					function: { name: "getWeather", arguments: '{"location":"Tokyo"}' },
				},
			],
		});
		expect(result.content).toEqual([
			{ type: "text", text: "Let me check." },
			{
				type: "tool_use",
				id: "call_123",
				name: "getWeather",
				input: { location: "Tokyo" },
			},
		]);
	});

	it("should parse empty message", () => {
		const result = parseAssistantMessage({});
		expect(result.content).toEqual([]);
	});

	it("should map token usage correctly", () => {
		const result = parseAssistantMessage(
			{ content: "Hello" },
			{ prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
		);
		expect(result.usage).toEqual({
			promptTokens: 10,
			completionTokens: 20,
			totalTokens: 30,
		});
	});

	it("should map token usage with missing values to 0", () => {
		const result = parseAssistantMessage({ content: "Hello" }, {});
		expect(result.usage).toEqual({
			promptTokens: 0,
			completionTokens: 0,
			totalTokens: 0,
		});
	});
});
