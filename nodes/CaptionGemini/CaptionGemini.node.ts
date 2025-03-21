import { generateObject, generateText } from 'ai';
import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';

export class CaptionGemini implements INodeType {
	description: INodeTypeDescription = {
		// Basic node details will go here
		displayName: 'Caption Gemini',
		name: 'captionGemini',
		icon: 'file:captionGemini.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Get video caption using GEMINI AI API',
		defaults: {
			name: 'Caption Gemini',
		},
		// @ts-ignore
		inputs: ['main'],
		// @ts-ignore
		outputs: ['main'],
		properties: [
			{
				displayName: 'Gemini API KEY',
				name: 'geminiApiKey',
				type: 'string',
				typeOptions: {
					password: true,
				},
				noDataExpression: true,
				required: true,
				placeholder: 'Api key for gemini',
				default: '',
			},
			{
				displayName: 'Media Url',
				name: 'mediaUrl',
				type: 'string',
				noDataExpression: true,
				required: true,
				placeholder: 'https://example-video.com/videoUrl.mp4',
				default: '',
			},
			{
				displayName: 'Model',
				name: 'model',
				type: 'options',
				options: [
					{
						name: 'Gemini 1.5 Flash',
						value: 'gemini-1.5-flash-latest',
					},
					{
						name: 'Gemini 1.5 Pro',
						value: 'gemini-1.5-pro-latest',
					},
					{
						name: 'Gemini 1.0 Pro',
						value: 'gemini-1.0-pro-latest',
					},
				],
				default: 'gemini-1.5-flash-latest',
				description: 'The Gemini model to use',
			},
			{
				displayName: 'Content Type',
				name: 'contentType',
				type: 'string',
				default: 'video/mp4',
				description: 'The content type of the video',
			},
			{
				displayName: 'Custom Prompt',
				name: 'useCustomPrompt',
				type: 'boolean',
				default: false,
				description: 'Whether to use a custom prompt',
			},
			{
				displayName: 'Prompt',
				name: 'customPrompt',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				description: 'Custom prompt to use for generating captions',
				displayOptions: {
					show: {
						useCustomPrompt: [true],
					},
				},
			},
			{
				displayName: 'Use Structured Output',
				name: 'useStructuredOutput',
				type: 'boolean',
				default: true,
				description: 'Whether to use structured output (recommended for default prompt)',
				displayOptions: {
					show: {
						useCustomPrompt: [true],
					},
				},
			},
			// Operations will go here
		],
	};
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();

		let mediaUrl: string;
		let geminiApiKey: string;
		let model: string;
		let contentType: string;
		let useCustomPrompt: boolean;
		let customPrompt: string;
		let useStructuredOutput: boolean;

		const returnData: INodeExecutionData[] = [];

		// Iterates over all input items and add the key "videoUrl" with the
		// value the parameter "videoUrl" resolves to.
		// (This could be a different value for each item in case it contains an expression)
		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				mediaUrl = this.getNodeParameter('mediaUrl', itemIndex, '') as string;
				geminiApiKey = this.getNodeParameter('geminiApiKey', itemIndex, '') as string;
				model = this.getNodeParameter('model', itemIndex, 'gemini-1.5-flash-latest') as string;
				contentType = this.getNodeParameter('contentType', itemIndex, 'video/mp4') as string;
				useCustomPrompt = this.getNodeParameter('useCustomPrompt', itemIndex, false) as boolean;

				let promptContent = '';

				if (useCustomPrompt) {
					customPrompt = this.getNodeParameter('customPrompt', itemIndex, '') as string;
					useStructuredOutput = this.getNodeParameter(
						'useStructuredOutput',
						itemIndex,
						true,
					) as boolean;
					promptContent = customPrompt;
				} else {
					promptContent = `Gere o subtitle para esse video, escreva o subtitle em formato de SRT, retorna isso no idioma original do video. seja fiel nas palavras do video.`;
					useStructuredOutput = true;
				}

				const google = createGoogleGenerativeAI({
					apiKey: geminiApiKey,
				});

				let result;

				if (useStructuredOutput) {
					const { object: subtitle } = await generateObject({
						model: google(model),
						messages: [
							{
								role: 'user',
								content: promptContent,
								experimental_attachments: [
									{
										url: mediaUrl,
										contentType: contentType,
									},
								],
							},
						],
						schema: z.object({
							subtitles: z.array(
								z.object({
									startTime: z.string(),
									endTime: z.string(),
									text: z.string(),
								}),
							),
						}),
					});

					result = subtitle;
				} else {
					const { text } = await generateText({
						model: google(model),
						messages: [
							{
								role: 'user',
								content: promptContent,
								experimental_attachments: [
									{
										url: mediaUrl,
										contentType: contentType,
									},
								],
							},
						],
					});

					result = { text };
				}

				returnData.push({
					json: {
						...result,
					},
					pairedItem: { item: itemIndex },
				});
			} catch (error) {
				if (this.continueOnFail()) {
					items.push({ json: this.getInputData(itemIndex)[0].json, error, pairedItem: itemIndex });
				} else {
					if (error.context) {
						error.context.itemIndex = itemIndex;
						throw error;
					}
					throw new NodeOperationError(this.getNode(), error, {
						itemIndex,
					});
				}
			}
		}
		return [returnData];
	}
}
