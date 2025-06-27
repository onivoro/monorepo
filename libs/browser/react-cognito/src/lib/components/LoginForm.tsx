import { useState } from 'react';
import { CognitoUser, CognitoUserPool, AuthenticationDetails, CognitoUserAttribute } from 'amazon-cognito-identity-js';
import { setCookie, getCookie, deleteCookie, TOKEN_NAMES } from '../utils/cookies';
import { useCognito } from '../providers/CognitoProvider';

interface LoginFormProps {
  cognitoConfig: {
    authority: string;
    client_id: string;
    redirect_uri: string;
    response_type: string;
    scope: string;
  };
  onAuthSuccess?: () => void;
  onLogout?: () => void;
}

export const LoginForm = ({ cognitoConfig, onAuthSuccess, onLogout }: LoginFormProps) => {
  const { loginWithOIDC } = useCognito();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [message, setMessage] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(!!getCookie(TOKEN_NAMES.ACCESS_TOKEN));
  const [isRegistering, setIsRegistering] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isForceChangePassword, setIsForceChangePassword] = useState(false);
  const [cognitoUserRef, setCognitoUserRef] = useState<CognitoUser | null>(null);

  const userPoolId = cognitoConfig.authority.split('/').pop()!;
  const clientId = cognitoConfig.client_id;
  const poolData = { UserPoolId: userPoolId, ClientId: clientId };
  const userPool = new CognitoUserPool(poolData);

  const handleOIDCLogin = (identityProvider: string) => {
    loginWithOIDC(identityProvider);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const authenticationData = { Username: username, Password: password };
    const authenticationDetails = new AuthenticationDetails(authenticationData);
    const userData = { Username: username, Pool: userPool };
    const cognitoUser = new CognitoUser(userData);
    setCognitoUserRef(cognitoUser);

    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: (result) => {
        const accessToken = result.getAccessToken().getJwtToken();
        const idToken = result.getIdToken().getJwtToken();
        const refreshToken = result.getRefreshToken().getToken();

        // Set cookies with appropriate expiry
        const accessTokenExpiry = new Date();
        accessTokenExpiry.setHours(accessTokenExpiry.getHours() + 1); // 1 hour expiry

        const refreshTokenExpiry = new Date();
        refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 30); // 30 days expiry

        setCookie(TOKEN_NAMES.ACCESS_TOKEN, accessToken, { expires: accessTokenExpiry });
        setCookie(TOKEN_NAMES.ID_TOKEN, idToken, { expires: accessTokenExpiry });
        setCookie(TOKEN_NAMES.REFRESH_TOKEN, refreshToken, { expires: refreshTokenExpiry });

        setMessage('Login successful!');
        setIsLoggedIn(true);
        setUsername('');
        setPassword('');
        onAuthSuccess?.();
      },
      onFailure: (err) => {
        setMessage(`Login failed: ${err.message}`);
      },
      newPasswordRequired: (userAttributes) => {
        // Handle new password required
        setIsForceChangePassword(true);
        setMessage('You need to change your password');
      }
    });
  };

  const handleForceChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cognitoUserRef) {
      setMessage('Something went wrong. Please try logging in again.');
      return;
    }

    cognitoUserRef.completeNewPasswordChallenge(newPassword, {}, {
      onSuccess: (result) => {
        const accessToken = result.getAccessToken().getJwtToken();
        const idToken = result.getIdToken().getJwtToken();
        const refreshToken = result.getRefreshToken().getToken();

        const accessTokenExpiry = new Date();
        accessTokenExpiry.setHours(accessTokenExpiry.getHours() + 1);

        const refreshTokenExpiry = new Date();
        refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 30);

        setCookie(TOKEN_NAMES.ACCESS_TOKEN, accessToken, { expires: accessTokenExpiry });
        setCookie(TOKEN_NAMES.ID_TOKEN, idToken, { expires: accessTokenExpiry });
        setCookie(TOKEN_NAMES.REFRESH_TOKEN, refreshToken, { expires: refreshTokenExpiry });

        setMessage('Password changed successfully! You are now logged in.');
        setIsLoggedIn(true);
        setIsForceChangePassword(false);
        setNewPassword('');
        onAuthSuccess?.();
      },
      onFailure: (err) => {
        setMessage(`Failed to change password: ${err.message}`);
      },
    });
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    const attributeList = [
      new CognitoUserAttribute({
        Name: 'email',
        Value: email
      })
    ];

    userPool.signUp(username, password, attributeList, [], (err, result) => {
      if (err) {
        setMessage(`Registration failed: ${err.message}`);
        console.error(err);
      } else {
        setMessage('Registration successful! Enter the confirmation code sent to your email.');
        setIsConfirming(true);
      }
    });
  };

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    const cognitoUser = new CognitoUser({
      Username: username,
      Pool: userPool,
    });
    cognitoUser.confirmRegistration(confirmationCode, true, (err, result) => {
      if (err) {
        setMessage(`Confirmation failed: ${err.message}`);
        console.error(err);
      } else {
        setMessage('Account confirmed! You can now log in.');
        setIsConfirming(false);
        setIsRegistering(false);
        setConfirmationCode('');
      }
    });
  };

  const handleLogout = () => {
    deleteCookie(TOKEN_NAMES.ACCESS_TOKEN);
    deleteCookie(TOKEN_NAMES.ID_TOKEN);
    deleteCookie(TOKEN_NAMES.REFRESH_TOKEN);
    setIsLoggedIn(false);
    setMessage('Logged out successfully.');
    onLogout?.();
  };

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) {
      setMessage('Please enter your username to reset password');
      return;
    }

    const userData = { Username: username, Pool: userPool };
    const cognitoUser = new CognitoUser(userData);

    cognitoUser.forgotPassword({
      onSuccess: () => {
        setMessage('Password reset code has been sent to your email');
        setIsConfirmingReset(true);
      },
      onFailure: (err) => {
        setMessage(`Failed to initiate password reset: ${err.message}`);
      },
    });
  };

  const handleConfirmPasswordReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !confirmationCode || !newPassword) {
      setMessage('Please fill in all fields');
      return;
    }

    const userData = { Username: username, Pool: userPool };
    const cognitoUser = new CognitoUser(userData);

    cognitoUser.confirmPassword(confirmationCode, newPassword, {
      onSuccess: () => {
        setMessage('Password has been reset successfully. You can now login.');
        setIsResettingPassword(false);
        setIsConfirmingReset(false);
        setConfirmationCode('');
        setNewPassword('');
      },
      onFailure: (err) => {
        setMessage(`Failed to reset password: ${err.message}`);
      },
    });
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
      <h2 className="text-2xl font-bold mb-6 text-center">
        {isLoggedIn ? 'Welcome' :
         isConfirming ? 'Confirm Account' :
         isRegistering ? 'Register' :
         isResettingPassword ? 'Reset Password' :
         isConfirmingReset ? 'Confirm Password Reset' :
         isForceChangePassword ? 'Change Password Required' : 'Login'}
      </h2>
      {!isLoggedIn ? (
        <div className="space-y-4">
          {isForceChangePassword ? (
            <>
              <p className="text-sm text-gray-600 mb-4">
                Your password needs to be changed before continuing.
              </p>
              <input
                type="password"
                placeholder="New Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleForceChangePassword}
                className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
              >
                Change Password
              </button>
            </>
          ) : (
            <>
              {isConfirming ? (
                <>
                  <input
                    type="text"
                    placeholder="Confirmation Code"
                    value={confirmationCode}
                    onChange={(e) => setConfirmationCode(e.target.value)}
                    className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleConfirm}
                    className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
                  >
                    Confirm
                  </button>
                </>
              ) : isResettingPassword ? (
                <>
                  <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleForgotPassword}
                    className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
                  >
                    Send Reset Code
                  </button>
                  <button
                    onClick={() => setIsResettingPassword(false)}
                    className="w-full bg-transparent p-2 rounded text-blue-500 hover:text-blue-600"
                  >
                    Back to Login
                  </button>
                </>
              ) : isConfirmingReset ? (
                <>
                  <input
                    type="text"
                    placeholder="Reset Code"
                    value={confirmationCode}
                    onChange={(e) => setConfirmationCode(e.target.value)}
                    className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="password"
                    placeholder="New Password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleConfirmPasswordReset}
                    className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
                  >
                    Confirm Password Reset
                  </button>
                </>
              ) : !isRegistering ? (
                <>
                  <button
                    onClick={() => handleOIDCLogin('MicrosoftEntra')}
                    className="w-full bg-[#2F2F2F] text-white p-2 rounded hover:bg-[#1F1F1F] flex items-center justify-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 23 23">
                      <path fill="#F25022" d="M1 1h10v10H1z"/>
                      <path fill="#00A4EF" d="M1 12h10v10H1z"/>
                      <path fill="#7FBA00" d="M12 1h10v10H12z"/>
                      <path fill="#FFB900" d="M12 12h10v10H12z"/>
                    </svg>
                    Sign in with Microsoft
                  </button>
                  <div className="relative flex items-center justify-center w-full my-4">
                    <div className="absolute w-full border-t border-gray-300"></div>
                    <div className="relative px-4 bg-white text-sm text-gray-500">or</div>
                  </div>
                  <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleLogin}
                    className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
                  >
                    Login
                  </button>
                  <div className="flex justify-between">
                    <button
                      onClick={() => setIsRegistering(true)}
                      className="text-blue-500 hover:text-blue-600"
                    >
                      Need to create an account?
                    </button>
                    <button
                      onClick={() => setIsResettingPassword(true)}
                      className="text-blue-500 hover:text-blue-600"
                    >
                      Forgot Password?
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleRegister}
                    className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
                  >
                    Register
                  </button>
                  <button
                    onClick={() => setIsRegistering(false)}
                    className="w-full bg-transparent p-2 rounded text-blue-500 hover:text-blue-600"
                  >
                    Already have an account?
                  </button>
                </>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <button
            onClick={handleLogout}
            className="w-full bg-red-500 text-white p-2 rounded hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      )}
      {message && (
        <p className="mt-4 text-center text-sm text-gray-600">{message}</p>
      )}
    </div>
  );
};

export default LoginForm;