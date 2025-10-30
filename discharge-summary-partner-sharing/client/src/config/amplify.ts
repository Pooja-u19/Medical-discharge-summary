import { Amplify } from 'aws-amplify';

const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: 'us-east-1_l8c8ko8oW',
      userPoolClientId: '209o5f29qvpln09vesd1649cn3',
      region: 'us-east-1',
    }
  }
};

Amplify.configure(amplifyConfig);

export default amplifyConfig;