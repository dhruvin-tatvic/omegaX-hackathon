// =============================================
// APEX MOTO — useForm Hook
// Handles form state, validation, and simulated submission.
// NOTE: No data is sent to any server. This is a frontend-only
// demonstration. Form submissions are purely simulated.
// =============================================

import { useState, useCallback } from 'react';

export function useForm(initialValues, validationRules) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const validate = useCallback((vals) => {
    const newErrors = {};
    Object.entries(validationRules).forEach(([field, rules]) => {
      const value = vals[field];
      if (rules.required && (!value || (typeof value === 'string' && !value.trim()))) {
        newErrors[field] = `${rules.label || field} is required`;
        return;
      }
      if (rules.pattern && value && !rules.pattern.test(value)) {
        newErrors[field] = rules.patternMsg || `Invalid ${rules.label || field}`;
        return;
      }
      if (rules.minLength && value && value.length < rules.minLength) {
        newErrors[field] = `${rules.label || field} must be at least ${rules.minLength} characters`;
        return;
      }
      if (rules.isCheckbox && !value) {
        newErrors[field] = rules.checkboxMsg || 'You must accept to continue';
      }
    });
    return newErrors;
  }, [validationRules]);

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    const newVal = type === 'checkbox' ? checked : value;
    setValues(prev => ({ ...prev, [name]: newVal }));
    if (touched[name]) {
      const singleError = validate({ ...values, [name]: newVal });
      setErrors(prev => ({ ...prev, [name]: singleError[name] }));
    }
  }, [values, touched, validate]);

  const handleBlur = useCallback((e) => {
    const { name } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    const singleError = validate(values);
    setErrors(prev => ({ ...prev, [name]: singleError[name] }));
  }, [values, validate]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    const allTouched = Object.keys(initialValues).reduce((acc, k) => ({ ...acc, [k]: true }), {});
    setTouched(allTouched);
    const newErrors = validate(values);
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setIsSubmitting(true);
    // Simulate network delay — no actual data transmission occurs
    await new Promise(res => setTimeout(res, 1500));
    setIsSubmitting(false);
    setIsSuccess(true);
  }, [values, validate, initialValues]);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
    setIsSuccess(false);
  }, [initialValues]);

  return {
    values, errors, touched, isSubmitting, isSuccess,
    handleChange, handleBlur, handleSubmit, reset,
  };
}
