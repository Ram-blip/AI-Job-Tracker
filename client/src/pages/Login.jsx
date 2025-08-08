export default function Login() {
    const login = () => { window.location.href = 'http://localhost:4000/auth/google'; };
  
    return (
      <div className="center">
        <div className="card">
          <h1>AI Job Tracker</h1>
          <p style={{ marginBottom: 24, color: '#666' }}>
            Sign in with Google to connect Gmail and track job applications automatically.
          </p>
          <button className="btn" onClick={login}>Sign in with Google</button>
        </div>
      </div>
    );
  }
  