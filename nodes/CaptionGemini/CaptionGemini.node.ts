import { generateObject } from 'ai';
import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';

export class CaptionGemini implements INodeType {
	description: INodeTypeDescription = {
		// Basic node details will go here
		displayName: 'Caption Gemini',
		name: 'CaptionGemini',
		icon: 'file:captionGemini.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Get video caption using GEMINI AI API',
		defaults: {
			name: 'Caption Gemini',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		properties: [
			{
				displayName: 'Gemini API KEY',
				name: 'geminiApiKey',
				type: 'string',
				required: true,
				placeholder: 'api_key for gemini',
				default: '',
			},
			{
				displayName: 'Video Url',
				name: 'videoUrl',
				type: 'string',
				required: true,
				placeholder: 'https://example-video.com/videoUrl.mp4',
				default: '',
			},
			// Operations will go here
		],
	};
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();

		let videoUrl: string;
		let geminiApiKey: string;

		const returnData: INodeExecutionData[] = [];

		// Iterates over all input items and add the key "videoUrl" with the
		// value the parameter "videoUrl" resolves to.
		// (This could be a different value for each item in case it contains an expression)
		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				videoUrl = this.getNodeParameter('videoUrl', itemIndex, '') as string;
				geminiApiKey = this.getNodeParameter('geminiApiKey', itemIndex, '') as string;

				const promptTranscriptionContentPT = `Gere o subtitle para esse video, escreva o subtitle em formato de SRT, retorna isso no idioma original do video. seja fiel nas palavras do video.`;

				const google = createGoogleGenerativeAI({
					apiKey: geminiApiKey,
				});

				const { object: subtitle } = await generateObject({
					model: google('gemini-1.5-flash-latest'),
					messages: [
						{
							role: 'user',
							content: promptTranscriptionContentPT,
							experimental_attachments: [
								{
									url: videoUrl,
									contentType: 'video/mp4',
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

				returnData.push({
					json: {
						...subtitle,
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
