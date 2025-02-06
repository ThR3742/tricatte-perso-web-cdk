import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as ebs from 'aws-cdk-lib/aws-elasticbeanstalk';
import * as iam from 'aws-cdk-lib/aws-iam';

export class TricattePersoWebCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    // example resource
    const queue = new sqs.Queue(this, 'TricattePersoWebCdkQueue', {
      visibilityTimeout: cdk.Duration.seconds(300)
    });

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

  }
}
