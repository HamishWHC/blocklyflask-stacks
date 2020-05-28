import * as cdk from '@aws-cdk/core';
import {Bucket} from "@aws-cdk/aws-s3";
import {
    CloudFrontAllowedCachedMethods,
    CloudFrontAllowedMethods,
    CloudFrontWebDistribution,
    HttpVersion,
    OriginProtocolPolicy,
    PriceClass,
    ViewerCertificate,
    ViewerProtocolPolicy
} from "@aws-cdk/aws-cloudfront";
import {Certificate} from "@aws-cdk/aws-certificatemanager";
import {AaaaRecord, ARecord, HostedZone, RecordTarget} from "@aws-cdk/aws-route53";
import {CloudFrontTarget} from "@aws-cdk/aws-route53-targets";
import {BlocklyFlaskFrontendCd} from "./blocklyflask-frontend-cd";
import {GitHubProps} from "./common";

interface BlocklyFlaskFrontendStackProps extends cdk.StackProps {
    frontendGitHubConfig: GitHubProps;
    cdnAliases: string[];
    hostedZoneDomain: string;
    cdnCertArn: string;
}

export class BlocklyFlaskFrontendStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props: BlocklyFlaskFrontendStackProps) {
        super(scope, id, props);

        let log_bucket = new Bucket(this, "LogBucket");

        let static_bucket = new Bucket(this, "StaticBucket", {
            publicReadAccess: true,
            websiteIndexDocument: "index.html",
            serverAccessLogsBucket: log_bucket,
            serverAccessLogsPrefix: "static-s3/"
        });

        let cdn_cert = Certificate.fromCertificateArn(this, "CloudfrontCert", props.cdnCertArn);

        let static_cdn = new CloudFrontWebDistribution(this, "CloudFront", {
            originConfigs: [{
                behaviors: [{
                    allowedMethods: CloudFrontAllowedMethods.GET_HEAD,
                    cachedMethods: CloudFrontAllowedCachedMethods.GET_HEAD,
                    isDefaultBehavior: true
                }],
                customOriginSource: {
                    domainName: static_bucket.bucketWebsiteDomainName,
                    originProtocolPolicy: OriginProtocolPolicy.HTTP_ONLY
                }
            }],
            viewerCertificate: ViewerCertificate.fromAcmCertificate(cdn_cert, {
                aliases: props.cdnAliases
            }),
            enableIpV6: true,
            defaultRootObject: "index.html",
            httpVersion: HttpVersion.HTTP2,
            loggingConfig: {
                bucket: log_bucket,
                prefix: "cdn/"
            },
            priceClass: PriceClass.PRICE_CLASS_ALL,
            viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS
        });

        let hosted_zone = HostedZone.fromLookup(this, 'CDNHostedZone', {
            domainName: props.hostedZoneDomain
        });
        props.cdnAliases.forEach(alias => {
            new ARecord(this, `CDNRecord${alias}A`, {
                zone: hosted_zone,
                target: RecordTarget.fromAlias(new CloudFrontTarget(static_cdn)),
                recordName: alias
            })
            new AaaaRecord(this, `CDNRecord${alias}AAAA`, {
                zone: hosted_zone,
                target: RecordTarget.fromAlias(new CloudFrontTarget(static_cdn)),
                recordName: alias
            })
        });

        new BlocklyFlaskFrontendCd(this, "CD", {
            account: this.account,
            gitHubConfig: props.frontendGitHubConfig,
            static_bucket: static_bucket,
            static_cdn: static_cdn
        })
    }
}
