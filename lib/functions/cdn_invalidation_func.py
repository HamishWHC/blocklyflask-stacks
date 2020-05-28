import boto3
import time
import os
import logging

def handle_s3_change(event, context):
    # paths = []
    # for items in event["Records"]:
    #     key = items["s3"]["object"]["key"]
    #     if key.endswith("index.html"):
    #         paths.append("/" + key[:-10])
    #     paths.append("/" + key)
    # print("Invalidating " + str(paths))

    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    codepipeline = boto3.client('codepipeline')

    try:
        client = boto3.client('cloudfront')
        batch = {
            'Paths': {
                'Quantity': 1,  # len(paths),
                'Items': ["/*"]  # paths
            },
            'CallerReference': str(time.time())
        }
        invalidation = client.create_invalidation(
            DistributionId=os.environ['CLOUDFRONT_DISTRIBUTION_ID'],
            InvalidationBatch=batch
        )
        logger.info("Sent Cloudfront Invalidation Request.")

        job_id = event['CodePipeline.job']['id']
        response = codepipeline.put_job_success_result(jobId=job_id)
        logger.info("Sent Put Job Success Result.")
        logger.debug(response)
    except Exception as error:
        logger.exception(error)
        response = codepipeline.put_job_failure_result(
            jobId=job_id,
            failureDetails={
              'type': 'JobFailed',
              'message': f'{error.__class__.__name__}: {str(error)}'
            }
        )
        logger.info("Sent Put Job Failure Result.")
        logger.debug(response)
    return
