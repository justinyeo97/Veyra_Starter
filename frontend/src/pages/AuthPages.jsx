import { useState } from 'react'
import { Button, Form, Spinner } from 'react-bootstrap'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthShell } from '../components/Layout'
import { Field, FormStatus, SubmitButton } from '../components/FormFields'
import { Icon, InlineAlert } from '../components/UI'
import { useApp } from '../context/useApp'
import { DEMO_USER } from '../data/demoData'
import { useForm, wait } from '../utils/validation'

const PASSWORD_RULE = {
  required: true,
  label: 'Password',
  minLength: 8,
  custom: (value) => (/\d/.test(value) && /[a-z]/i.test(value) ? '' : 'Use at least one letter and one number.'),
}

function PasswordField({ form, name, label, autoComplete }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="password-field">
      <Field form={form} name={name} label={label} type={visible ? 'text' : 'password'} required autoComplete={autoComplete} />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        <Icon name={visible ? 'eye-slash' : 'eye'} />
      </button>
    </div>
  )
}

function AuthActions({ form, submitLabel, onCancel, cancelLabel = 'Cancel' }) {
  return (
    <>
      <FormStatus form={form} />
      <div className="d-grid gap-2">
        <SubmitButton form={form} block>
          {submitLabel}
        </SubmitButton>
        <Button variant="outline-secondary" onClick={onCancel} disabled={form.submitting}>
          {cancelLabel}
        </Button>
      </div>
    </>
  )
}

export function LoginPage() {
  const { actions, notify } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from && location.state.from !== '/logout' ? location.state.from : '/'
  const form = useForm({
    initialValues: { email: '', password: '' },
    rules: {
      email: { required: true, type: 'email', label: 'Email' },
      password: { required: true, label: 'Password' },
    },
    onSubmit: async (values) => {
      await wait(500)
      const account = await actions.login(values.email, values.password)
      notify(`Welcome back, ${account.name.split(' ')[0]}.`)
      navigate(from, { replace: true })
    },
  })

  return (
    <AuthShell
      title="Log in"
      subtitle="Welcome back. Log in to manage your store."
      footer={
        <>
          New to Veyra? <Link to="/signup">Create an account</Link>
        </>
      }
    >
      {location.state?.passwordReset && (
        <InlineAlert variant="success">Your password was reset. Log in with your new password.</InlineAlert>
      )}
      <div className="demo-callout">
        <div>
          <div className="fw-semibold small">Demo account</div>
          <div className="small text-body-secondary">
            {DEMO_USER.email} · {DEMO_USER.password}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline-secondary"
          onClick={() => form.patchValues({ email: DEMO_USER.email, password: DEMO_USER.password })}
          disabled={form.submitting}
        >
          Use demo
        </Button>
      </div>
      <Form noValidate onSubmit={form.handleSubmit}>
        <Field form={form} name="email" label="Email" type="email" required autoComplete="email" />
        <PasswordField form={form} name="password" label="Password" autoComplete="current-password" />
        <div className="text-end mb-3 mt-n2">
          <Link to="/forgot-password" className="small">
            Forgot password?
          </Link>
        </div>
        <AuthActions form={form} submitLabel="Log in" onCancel={() => form.reset()} cancelLabel="Clear" />
      </Form>
    </AuthShell>
  )
}

export function SignupPage() {
  const { actions, notify } = useApp()
  const navigate = useNavigate()
  const form = useForm({
    initialValues: { name: '', email: '', password: '', confirm: '' },
    rules: {
      name: { required: true, label: 'Full name', minLength: 2, maxLength: 80 },
      email: { required: true, type: 'email', label: 'Email' },
      password: PASSWORD_RULE,
      confirm: { required: true, label: 'Password confirmation', matches: 'password', matchMessage: 'Passwords do not match.' },
    },
    onSubmit: async (values) => {
      await wait(600)
      const account = await actions.signup(values)
      notify(`Welcome to Veyra, ${account.name.split(' ')[0]}.`)
      navigate('/', { replace: true })
    },
  })

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start tracking inventory, orders and profit in minutes."
      footer={
        <>
          Already have an account? <Link to="/login">Log in</Link>
        </>
      }
    >
      <Form noValidate onSubmit={form.handleSubmit}>
        <Field form={form} name="name" label="Full name" required autoComplete="name" />
        <Field form={form} name="email" label="Email" type="email" required autoComplete="email" />
        <PasswordField form={form} name="password" label="Password" autoComplete="new-password" />
        <Field form={form} name="confirm" label="Confirm password" type="password" required autoComplete="new-password" help="At least 8 characters, with a letter and a number." />
        <AuthActions form={form} submitLabel="Create account" onCancel={() => navigate('/login')} />
      </Form>
    </AuthShell>
  )
}

export function ForgotPasswordPage() {
  const { actions } = useApp()
  const navigate = useNavigate()
  const [sent, setSent] = useState(null)
  const form = useForm({
    initialValues: { email: '' },
    rules: { email: { required: true, type: 'email', label: 'Email' } },
    onSubmit: async (values) => {
      await wait(600)
      const code = await actions.requestPasswordReset(values.email)
      setSent({ email: values.email.trim().toLowerCase(), code })
    },
  })

  if (sent) {
    return (
      <AuthShell title="Check your email" subtitle={`We sent a 6-digit reset code to ${sent.email}.`}>
        <InlineAlert variant="info" title="Demo mode">
          Veyra has no email service connected, so no email was sent. Your reset code is <strong className="reset-code">{sent.code}</strong>. It expires in 30 minutes.
        </InlineAlert>
        <div className="d-grid gap-2">
          <Button variant="primary" onClick={() => navigate(`/reset-password?email=${encodeURIComponent(sent.email)}`)}>
            Enter reset code
          </Button>
          <Button variant="outline-secondary" onClick={() => setSent(null)}>
            Use a different email
          </Button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Enter your account email and we will send you a reset code."
      footer={
        <>
          Remembered it? <Link to="/login">Back to log in</Link>
        </>
      }
    >
      <Form noValidate onSubmit={form.handleSubmit}>
        <Field form={form} name="email" label="Email" type="email" required autoComplete="email" />
        <AuthActions form={form} submitLabel="Send reset code" onCancel={() => navigate('/login')} />
      </Form>
    </AuthShell>
  )
}

export function ResetPasswordPage() {
  const { actions, notify } = useApp()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const form = useForm({
    initialValues: { email: params.get('email') || '', code: '', password: '', confirm: '' },
    rules: {
      email: { required: true, type: 'email', label: 'Email' },
      code: {
        required: true,
        label: 'Reset code',
        custom: (value) => (/^\d{6}$/.test(value.trim()) ? '' : 'Enter the 6-digit code.'),
      },
      password: { ...PASSWORD_RULE, label: 'New password' },
      confirm: { required: true, label: 'Password confirmation', matches: 'password', matchMessage: 'Passwords do not match.' },
    },
    onSubmit: async (values) => {
      await wait(600)
      await actions.resetPassword(values)
      notify('Password reset. Log in with your new password.')
      navigate('/login', { replace: true, state: { passwordReset: true } })
    },
  })

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter the code we sent you and choose a new password."
      footer={
        <>
          Need a new code? <Link to="/forgot-password">Request another</Link>
        </>
      }
    >
      <Form noValidate onSubmit={form.handleSubmit}>
        <Field form={form} name="email" label="Email" type="email" required autoComplete="email" />
        <Field form={form} name="code" label="Reset code" required placeholder="123456" autoComplete="one-time-code" />
        <PasswordField form={form} name="password" label="New password" autoComplete="new-password" />
        <Field form={form} name="confirm" label="Confirm new password" type="password" required autoComplete="new-password" />
        <AuthActions form={form} submitLabel="Reset password" onCancel={() => navigate('/login')} />
      </Form>
    </AuthShell>
  )
}

export function LogoutPage() {
  const { user, actions } = useApp()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  async function logout() {
    setBusy(true)
    await wait(400)
    await actions.logout()
    setBusy(false)
  }

  if (!user) {
    return (
      <AuthShell title="You are logged out" subtitle="Your data stays saved in your Veyra database for next time.">
        <div className="d-grid gap-2">
          <Button variant="primary" onClick={() => navigate('/login')}>
            Log in again
          </Button>
          <Button variant="outline-secondary" onClick={() => navigate('/signup')}>
            Create a new account
          </Button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Log out of Veyra?" subtitle={`You are logged in as ${user.email}.`}>
      <div className="d-grid gap-2">
        <Button variant="primary" onClick={logout} disabled={busy}>
          {busy && <Spinner animation="border" size="sm" className="me-2" />}
          Log out
        </Button>
        <Button variant="outline-secondary" onClick={() => navigate('/')} disabled={busy}>
          Cancel
        </Button>
      </div>
    </AuthShell>
  )
}
