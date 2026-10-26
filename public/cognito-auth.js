// Cognito email + TOTP for Sandbox. Uses Cognito IdP HTTP API (no Amplify CDN).
(function (global) {
  var STORE = 'vaathi.sandbox.auth';
  var cfg = global.VAATHI_COGNITO || {};

  function endpoint() {
    return (cfg.endpoint || '').replace(/\/?$/, '/');
  }

  function clientId() {
    return cfg.clientId || '';
  }

  function saveSession(session) {
    try {
      sessionStorage.setItem(STORE, JSON.stringify(session || {}));
    } catch (e) {}
  }

  function loadSession() {
    try {
      return JSON.parse(sessionStorage.getItem(STORE) || '{}') || {};
    } catch (e) {
      return {};
    }
  }

  function clearSession() {
    try {
      sessionStorage.removeItem(STORE);
    } catch (e) {}
  }

  function accessToken() {
    var s = loadSession();
    return s.accessToken || '';
  }

  function isSignedIn() {
    return !!accessToken();
  }

  async function cognitoCall(target, body) {
    var resp = await fetch(endpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.' + target,
      },
      body: JSON.stringify(body),
    });
    var data = await resp.json().catch(function () { return {}; });
    if (!resp.ok || data.__type) {
      var msg = data.message || data.__type || ('Cognito ' + resp.status);
      throw new Error(msg);
    }
    return data;
  }

  async function signUp(email, password) {
    return cognitoCall('SignUp', {
      ClientId: clientId(),
      Username: email,
      Password: password,
      UserAttributes: [{ Name: 'email', Value: email }],
    });
  }

  async function confirmSignUp(email, code) {
    return cognitoCall('ConfirmSignUp', {
      ClientId: clientId(),
      Username: email,
      ConfirmationCode: code,
    });
  }

  async function initiateAuth(email, password) {
    return cognitoCall('InitiateAuth', {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: clientId(),
      AuthParameters: { USERNAME: email, PASSWORD: password },
    });
  }

  async function respondMfa(email, session, code) {
    return cognitoCall('RespondToAuthChallenge', {
      ClientId: clientId(),
      ChallengeName: 'SOFTWARE_TOKEN_MFA',
      Session: session,
      ChallengeResponses: {
        USERNAME: email,
        SOFTWARE_TOKEN_MFA_CODE: code,
      },
    });
  }

  async function respondMfaSetup(email, session) {
    return cognitoCall('RespondToAuthChallenge', {
      ClientId: clientId(),
      ChallengeName: 'MFA_SETUP',
      Session: session,
      ChallengeResponses: { USERNAME: email },
    });
  }

  async function associateSoftwareToken(session) {
    return cognitoCall('AssociateSoftwareToken', { Session: session });
  }

  async function verifySoftwareToken(session, code) {
    return cognitoCall('VerifySoftwareToken', {
      Session: session,
      UserCode: code,
      FriendlyDeviceName: 'vaathi-authenticator',
    });
  }

  function storeAuthResult(result, email) {
    var auth = result.AuthenticationResult || {};
    saveSession({
      email: email,
      accessToken: auth.AccessToken || '',
      idToken: auth.IdToken || '',
      refreshToken: auth.RefreshToken || '',
      expiresAt: Date.now() + ((auth.ExpiresIn || 3600) * 1000),
    });
  }

  global.VaathiAuth = {
    loadSession: loadSession,
    clearSession: clearSession,
    accessToken: accessToken,
    isSignedIn: isSignedIn,
    signUp: signUp,
    confirmSignUp: confirmSignUp,
    initiateAuth: initiateAuth,
    respondMfa: respondMfa,
    respondMfaSetup: respondMfaSetup,
    associateSoftwareToken: associateSoftwareToken,
    verifySoftwareToken: verifySoftwareToken,
    storeAuthResult: storeAuthResult,
  };
})(window);
