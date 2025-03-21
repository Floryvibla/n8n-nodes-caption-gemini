import { ICredentialType, INodeProperties } from 'n8n-workflow';

export class ExampleCredentialsApi implements ICredentialType {
	name = 'exampleCredentialsApi';
	displayName = 'Example Credentials API';
	properties: INodeProperties[] = [
		// The credentials to get from user and save encrypted.
		// Properties can be defined exactly in the same way
		// as node properties.
	];

	// This credential is currently not used by any node directly
	// but the HTTP Request node can use it to make requests.
	// The credential is also testable due to the `test` property below
}
