import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
export interface CustomizedProps extends StackProps {
    stackName: string;
}
export declare class CdkChatgptCloneStackAP extends Stack {
    constructor(scope: Construct, id: string, props: CustomizedProps);
}
export declare class CdkChatgptCloneStackUS extends Stack {
    constructor(scope: Construct, id: string, props: CustomizedProps);
}
export declare class CdkUserPoolStackAP extends Stack {
    constructor(scope: Construct, id: string, props: CustomizedProps);
}
export declare class CdkOIDCStackAP extends Stack {
    constructor(scope: Construct, id: string, props: CustomizedProps);
}