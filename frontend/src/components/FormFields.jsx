import { Button, Form, InputGroup, Modal, Spinner } from 'react-bootstrap'
import { Icon, InlineAlert } from './UI'

export function Field({
  form,
  name,
  label,
  type = 'text',
  as,
  options = [],
  placeholder,
  help,
  required = false,
  prefix,
  suffix,
  min,
  max,
  step,
  rows = 3,
  disabled = false,
  autoComplete,
  onChange,
  className = 'mb-3',
  emptyOption,
}) {
  const id = `field-${name}`
  const error = form.errors[name]
  const common = {
    id,
    name,
    value: form.values[name] ?? '',
    onChange: onChange || form.handleChange,
    onBlur: form.handleBlur,
    isInvalid: Boolean(error),
    disabled: disabled || form.submitting,
    required,
    'aria-describedby': help ? `${id}-help` : undefined,
  }

  let control
  if (as === 'select') {
    control = (
      <Form.Select {...common}>
        {emptyOption !== undefined && <option value="">{emptyOption}</option>}
        {options.map((option) => {
          const value = typeof option === 'object' ? option.value : option
          const text = typeof option === 'object' ? option.label : option
          return (
            <option key={value} value={value} disabled={typeof option === 'object' && option.disabled}>
              {text}
            </option>
          )
        })}
      </Form.Select>
    )
  } else if (as === 'textarea') {
    control = <Form.Control {...common} as="textarea" rows={rows} placeholder={placeholder} />
  } else {
    control = (
      <Form.Control
        {...common}
        type={type}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        autoComplete={autoComplete}
        inputMode={type === 'number' ? 'decimal' : undefined}
      />
    )
  }

  return (
    <Form.Group className={className} controlId={id}>
      {label && (
        <Form.Label>
          {label}
          {required && <span className="required-mark" aria-hidden="true"> *</span>}
        </Form.Label>
      )}
      {prefix || suffix ? (
        <InputGroup hasValidation>
          {prefix && <InputGroup.Text>{prefix}</InputGroup.Text>}
          {control}
          {suffix && <InputGroup.Text>{suffix}</InputGroup.Text>}
          <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>
        </InputGroup>
      ) : (
        <>
          {control}
          <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>
        </>
      )}
      {help && !error && (
        <Form.Text id={`${id}-help`} className="text-body-secondary">
          {help}
        </Form.Text>
      )}
    </Form.Group>
  )
}

export function SubmitButton({ form, children, className = '', block = false }) {
  return (
    <Button
      type="submit"
      variant="primary"
      disabled={!form.isValid || form.submitting}
      className={`${block ? 'w-100' : ''} ${className}`}
    >
      {form.submitting && <Spinner animation="border" size="sm" className="me-2" />}
      {form.submitting ? 'Saving…' : children}
    </Button>
  )
}

export function FormStatus({ form, hint = 'Fill in every required field to continue.' }) {
  if (form.submitError) {
    return <InlineAlert variant="danger">{form.submitError}</InlineAlert>
  }
  if (!form.isValid && !form.submitting) {
    return (
      <p className="form-hint">
        <Icon name="info-circle" className="me-1" />
        {hint}
      </p>
    )
  }
  return null
}

export function FormModal({ title, onHide, form, submitLabel = 'Save', size = 'lg', children, headerExtra }) {
  return (
    <Modal show onHide={form.submitting ? undefined : onHide} size={size} centered scrollable backdrop="static">
      <Form noValidate onSubmit={form.handleSubmit} className="modal-form">
        <Modal.Header closeButton={!form.submitting}>
          <Modal.Title as="h2" className="h5 mb-0">
            {title}
          </Modal.Title>
          {headerExtra}
        </Modal.Header>
        <Modal.Body>{children}</Modal.Body>
        <Modal.Footer className="flex-column flex-sm-row align-items-stretch align-items-sm-center">
          <div className="me-sm-auto">
            <FormStatus form={form} />
          </div>
          <div className="d-flex gap-2 justify-content-end">
            <Button variant="outline-secondary" onClick={onHide} disabled={form.submitting}>
              Cancel
            </Button>
            <SubmitButton form={form}>{submitLabel}</SubmitButton>
          </div>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}
