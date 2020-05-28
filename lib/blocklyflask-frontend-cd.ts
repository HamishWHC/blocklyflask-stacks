import * as cdk from '@aws-cdk/core';
import {Artifact, Pipeline} from "@aws-cdk/aws-codepipeline";
import {BuildEnvironmentVariableType, PipelineProject} from "@aws-cdk/aws-codebuild";
import {
    CodeBuildAction,
    CodeBuildActionType,
    GitHubSourceAction,
    GitHubTrigger,
    LambdaInvokeAction
} from "@aws-cdk/aws-codepipeline-actions";
import {Code, Function, Runtime} from "@aws-cdk/aws-lambda";
import * as path from "path";
import {Effect, PolicyStatement} from "@aws-cdk/aws-iam";
import {CloudFrontWebDistribution} from "@aws-cdk/aws-cloudfront";
import {Bucket} from "@aws-cdk/aws-s3";
import {GitHubProps} from "./common";

interface BlocklyFlaskFrontendCdProps {
    account: string;
    static_cdn: CloudFrontWebDistribution;
    static_bucket: Bucket;
    gitHubConfig: GitHubProps;
}

export class BlocklyFlaskFrontendCd extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string, props: BlocklyFlaskFrontendCdProps) {
        super(scope, id);

        let cdn_invalidation_func = new Function(this, "CDNInvalidationFunc", {
            code: Code.fromAsset(path.join(__dirname, 'functions')),
            handler: "cdn_invalidation_func.handle_s3_change",
            runtime: Runtime.PYTHON_3_8,
            environment: {
                CLOUDFRONT_DISTRIBUTION_ID: props.static_cdn.distributionId
            }
        });
        cdn_invalidation_func.addToRolePolicy(new PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
                "cloudfront:CreateInvalidation"
            ],
            resources: [`arn:aws:cloudfront::${props.account}:distribution/${props.static_cdn.distributionId}`]
        }))
        cdn_invalidation_func.addToRolePolicy(new PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
                "codepipeline:PutJobSuccessResult",
                "codepipeline:PutJobFailureResult"
            ],
            resources: ["*"]
        }))

        let sourceOutput = new Artifact();

        let pipelineProject = new PipelineProject(this, "SitePipelineProject");
        pipelineProject.addToRolePolicy(new PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
                "s3:PutObject",
                "s3:GetObject",
                "s3:GetBucketWebsite",
                "s3:ListBucket",
                "s3:DeleteObject"
            ],
            resources: [
                props.static_bucket.bucketArn,
                props.static_bucket.arnForObjects("*")
            ]
        }));

        let pipeline = new Pipeline(this, 'SitePipeline', {
            stages: [
                {
                    stageName: 'Source',
                    actions: [
                        new GitHubSourceAction({
                            actionName: 'GitHub_Source',
                            owner: props.gitHubConfig.username,
                            repo: props.gitHubConfig.repo,
                            oauthToken: cdk.SecretValue.secretsManager(props.gitHubConfig.tokenSecretId, {jsonField: props.gitHubConfig.tokenSecretJsonField}),
                            output: sourceOutput,
                            branch: props.gitHubConfig.branch,
                            trigger: GitHubTrigger.WEBHOOK
                        })
                    ],
                },
                {
                    stageName: "Build",
                    actions: [
                        new CodeBuildAction({
                            actionName: "CodeBuild",
                            project: pipelineProject,
                            input: sourceOutput,
                            outputs: [new Artifact()],
                            environmentVariables: {
                                BUCKET_NAME: {
                                    value: props.static_bucket.bucketName,
                                    type: BuildEnvironmentVariableType.PLAINTEXT
                                }
                            },
                            type: CodeBuildActionType.BUILD
                        })
                    ]
                },
                {
                    stageName: "Deploy",
                    actions: [
                        new LambdaInvokeAction({
                            actionName: "CDNInvalidationFunction",
                            lambda: cdn_invalidation_func
                        })
                    ]
                }
            ],
        });
    }
}
