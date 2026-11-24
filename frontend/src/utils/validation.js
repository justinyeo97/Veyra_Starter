import { useMemo, useState } from 'react'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE = /^[+()\d\s-]{7,20}$/
const URL_PATTERN = /^(https?:\/\/|data:image\/)/i

function isEmpty(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
}

export function validateField(value, rule = {}, values = {}) {
  const label = rule.label || 'This field'
  if (isEmpty(value)) {
    return rule.required ? `${label} is required.` : ''
  }
  if (rule.type === 'email' && !EMAIL.test(String(value).trim())) {
    return 'Enter a valid email address.'
  }
  if (rule.type === 'phone' && !PHONE.test(String(value).trim())) {
    return 'Enter a valid phone number.'
  }
  if (rule.type === 'url' && !URL_PATTERN.test(String(value).trim())) {
    return 'Enter a full image URL starting with http:// or https://.'
  }
  if (rule.type === 'date' && Number.isNaN(new Date(value).getTime())) {
    return 'Enter a valid date.'
  }
  if (rule.type === 'number') {
    const number = Number(value)
    if (!Number.isFinite(number)) return `${label} must be a number.`
    if (rule.integer && !Number.isInteger(number)) return `${label} must be a whole number.`
    if (rule.min !== undefined && number < rule.min) return `${label} must be at least ${rule.min}.`
    if (rule.max !== undefined && number > rule.max) return `${label} must be ${rule.max} or less.`
  }
  if (rule.minLength && String(value).trim().length < rule.minLength) {
    return `${label} must be at least ${rule.minLength} characters.`
  }
  if (rule.maxLength && String(value).length > rule.maxLength) {
    return `${label} must be ${rule.maxLength} characters or fewer.`
  }
  if (rule.matches && value !== values[rule.matches]) {
    return rule.matchMessage || 'Values do not match.'
  }
  if (rule.custom) {
    return rule.custom(value, values) || ''
  }
  return ''
}

export function validate(values, rules) {
  const errors = {}
  Object.entries(rules).forEach(([field, rule]) => {
    const message = validateField(values[field], rule, values)
    if (message) errors[field] = message
  })
  return errors
}

export function useForm({ initialValues, rules, onSubmit }) {
  const [values, setValues] = useState(initialValues)
  const [touched, setTouched] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const allErrors = useMemo(() => validate(values, rules), [values, rules])
  const isValid = Object.keys(allErrors).length === 0

  const errors = useMemo(() => {
    const visible = {}
    Object.entries(allErrors).forEach(([field, message]) => {
      if (submitted || touched[field]) visible[field] = message
    })
    return visible
  }, [allErrors, touched, submitted])

  function setValue(name, value) {
    setValues((current) => ({ ...current, [name]: value }))
    setSubmitError('')
  }

  function patchValues(patch) {
    setValues((current) => ({ ...current, ...patch }))
    setSubmitError('')
  }

  function handleChange(event) {
    const { name, value, type, checked } = event.target
    setValue(name, type === 'checkbox' ? checked : value)
  }

  function handleBlur(event) {
    const { name } = event.target
    setTouched((current) => ({ ...current, [name]: true }))
  }

  function reset(nextValues = initialValues) {
    setValues(nextValues)
    setTouched({})
    setSubmitted(false)
    setSubmitError('')
  }

  function touch(name) {
    setTouched((current) => ({ ...current, [name]: true }))
  }

  async function handleSubmit(event) {
    event?.preventDefault()
    setSubmitted(true)
    if (!isValid || submitting) return
    setSubmitting(true)
    setSubmitError('')
    try {
      await onSubmit(values)
    } catch (error) {
      setSubmitError(error.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return {
    values,
    errors,
    allErrors,
    isValid,
    submitting,
    submitError,
    setValue,
    patchValues,
    handleChange,
    handleBlur,
    handleSubmit,
    touch,
    reset,
  }
}

export function wait(ms = 450) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
