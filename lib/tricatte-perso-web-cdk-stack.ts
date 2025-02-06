import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ebs from 'aws-cdk-lib/aws-elasticbeanstalk';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';

export class TricattePersoWebCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 🟢 Nom de l'application Beanstalk
    const appName = 'TricattePersoWebCdkEbsEnv';

    // 🟢 Rôle IAM pour Elastic Beanstalk Service Role
    const ebServiceRole = iam.Role.fromRoleArn(this, 'EBServiceRole', 'arn:aws:iam::647836924460:role/service-role/aws-elasticbeanstalk-service-role');

    // 🟢 Définition de l'application Beanstalk
    const app = new ebs.CfnApplication(this, 'BeanstalkApplication', {
      applicationName: appName,
    });

    // 🟢 Création de l'environnement Beanstalk
    const env = new ebs.CfnEnvironment(this, 'BeanstalkEnvironment', {
      applicationName: app.applicationName!,
      environmentName: 'TricattePersoWebCdkEbsEnv', // 🔥 Nom fixe pour CodePipeline
      platformArn: 'arn:aws:elasticbeanstalk:us-east-1::platform/Python 3.13 running on 64bit Amazon Linux 2023/4.4.0',
      solutionStackName: undefined, // On utilise PlatformArn
      cnamePrefix: 'tricatte-web-perso-app-env-v2',
      tier: {
        name: 'WebServer',
        type: 'Standard',
      },
      optionSettings: [
        // 🟢 VPC et Subnets
        { namespace: 'aws:ec2:vpc', optionName: 'VPCId', value: 'vpc-0a4d3aae32e774328' },
        { namespace: 'aws:ec2:vpc', optionName: 'Subnets', value: 'subnet-03e714a5435ed229b,subnet-0d72d999b5df011e9' },
        { namespace: 'aws:ec2:vpc', optionName: 'DBSubnets', value: 'subnet-03e714a5435ed229b,subnet-0d72d999b5df011e9' },

        // 🟢 Instance et réseau
        { namespace: 'aws:autoscaling:launchconfiguration', optionName: 'EC2KeyName', value: 'laptop-m3' },
        { namespace: 'aws:ec2:vpc', optionName: 'AssociatePublicIpAddress', value: 'false' }, // 🔥 Correction du namespace

        // 🟢 Load Balancer
        { namespace: 'aws:elasticbeanstalk:environment', optionName: 'LoadBalancerType', value: 'application' },
        { namespace: 'aws:elasticbeanstalk:environment', optionName: 'EnvironmentType', value: 'SingleInstance' },

        // 🟢 Rôles IAM pour l'instance EC2
        { namespace: 'aws:autoscaling:launchconfiguration', optionName: 'IamInstanceProfile', value: 'aws-elasticbeanstalk-ec2-role' }, // 🔥 Correction du namespace

        // 🟢 Configuration de la gestion des mises à jour
        { namespace: 'aws:elasticbeanstalk:managedactions', optionName: 'ManagedActionsEnabled', value: 'false' },
        { namespace: 'aws:elasticbeanstalk:managedactions', optionName: 'PreferredStartTime', value: 'FRI:14:03' },
        { namespace: 'aws:elasticbeanstalk:managedactions:platformupdate', optionName: 'UpdateLevel', value: 'minor' },

        // 🟢 Activation du reporting CloudWatch
        {
          namespace: 'aws:elasticbeanstalk:healthreporting:system',
          optionName: 'ConfigDocument',
          value: JSON.stringify({
            Version: 1,
            CloudWatchMetrics: {
              Instance: {},
              Environment: {}
            },
            Rules: {
              Environment: {
                ELB: {
                  ELBRequests4xx: { Enabled: true }
                }
              }
            }
          })
        }
      ],
    });

    env.addDependency(app);

    // 🟢 Rôle IAM pour CodePipeline (reprend ton ARN)
    const pipelineRole = iam.Role.fromRoleArn(
      this,
      'PipelineRole',
      'arn:aws:iam::647836924460:role/service-role/tricatte-web-perso-app-role',
      { mutable: false }
    );

    // 🟢 Bucket S3 pour stocker les artefacts (reprend ton bucket existant)
    const artifactBucket = s3.Bucket.fromBucketName(
      this,
      'PipelineArtifactBucket',
      'codepipeline-us-east-1-816852372194'
    );

    // 🟢 Création du pipeline
    const pipeline = new codepipeline.Pipeline(this, 'BeanstalkPipeline', {
      pipelineName: 'tricatte-web-perso-app-v2',
      role: pipelineRole,
      artifactBucket: artifactBucket,
    });

    // 🟢 Étape Source (CodeStar -> GitHub)
    const sourceOutput = new codepipeline.Artifact('SourceArtifact');
    const sourceAction = new codepipeline_actions.CodeStarConnectionsSourceAction({
      actionName: 'Source',
      owner: 'ThR3742', // Ton utilisateur GitHub
      repo: 'tricatte-perso-web',
      branch: 'main',
      connectionArn: 'arn:aws:codeconnections:us-east-1:647836924460:connection/5622f6c8-d233-4688-b889-44d51864296f',
      output: sourceOutput,
      triggerOnPush: true, // Déclenche le pipeline à chaque commit
    });

    pipeline.addStage({
      stageName: 'Source',
      actions: [sourceAction],
    });

    // 🟢 Étape Deploy (Elastic Beanstalk)
    const deployAction = new codepipeline_actions.ElasticBeanstalkDeployAction({
      actionName: 'Deploy',
      applicationName: app.applicationName!,
      environmentName: env.environmentName!,
      input: sourceOutput,
    });

    pipeline.addStage({
      stageName: 'Deploy',
      actions: [deployAction],
    });

    pipeline.node.addDependency(env);

  }
}
