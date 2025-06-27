import React, { ChangeEventHandler, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Checkbox,
  FormControlLabel,
  Typography,
  FormHelperText
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { TFormFields } from '../types/form-fields.type';
import { TFormLayout } from '../types/form-layout.type';
import { getErrorMessage } from '@onivoro/browser/forms';
import { IFieldOption } from '../types/field-option.interface';

export function ManagedForm<TExternalData, TInternalData = any>(
    { config, layout, value, children, onChange }: {
        onChange?: (_: any) => any,
        config: TFormFields<TExternalData>,
        layout: TFormLayout<TExternalData>,
        value: TExternalData | undefined,
        children?: any
    }) {

    const theme = useTheme();
    const [_externalValue, _externalValueSetter] = useState<TExternalData | undefined>(value);
    useEffect(() => { _externalValueSetter(value); }, [value]);

    const [_config, _configSetter] = useState<TFormFields<TExternalData>>(config);
    useEffect(() => { _configSetter(config); }, [config]);

    const [_layout, _layoutSetter] = useState<TFormLayout<TExternalData>>(layout);
    useEffect(() => { _layoutSetter(layout); }, [layout]);

    const [_internalValue, _internalValueSetter] = useState<TInternalData>();
    const previousExternalValueRef = useRef<TExternalData | undefined>();
    const [_errors, _errorsSetter] = useState<Record<string, { type: string } | undefined>>({});

    const _toFormValue = useCallback((__config: TFormFields<TExternalData>, __value: TExternalData | undefined) => {
        return {
            ...__value, ...Object.entries(__config)
                .reduce((_, [name, fieldConfig]: any) => {
                    return {
                        ..._,
                        [name]: (fieldConfig.toFormValue ? (fieldConfig.toFormValue(_[name] as any) as any) : (_[name] as any))
                    };
                }, { ...__value } as any) as TInternalData
        };
    }, []);

    const _fromFormValue = useCallback((__config: TFormFields<TExternalData>, __value: TInternalData | undefined) => {
        return {
            ...__value, ...Object.entries(__config)
                .reduce((_, [name, fieldConfig]: any) => {
                    return {
                        ..._,
                        [name]: (fieldConfig.fromFormValue ? (fieldConfig.fromFormValue(_[name] as any) as any) : (_[name] as any))
                    };
                }, { ...__value } as any) as TExternalData
        };
    }, []);

    const _validateField = useCallback((fieldName: string, value: any, validators: IFieldOption['validators']): { type: string } | undefined => {
        if (!validators) return undefined;

        // Required validation
        if (validators.required) {
            if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
                return { type: 'required' };
            }
        }

        // Skip other validations if value is empty and not required
        if (value === undefined || value === null || value === '') {
            return undefined;
        }

        const stringValue = String(value);
        const numericValue = Number(value);

        // MinLength validation
        if (validators.minLength !== undefined && stringValue.length < validators.minLength) {
            return { type: 'minLength' };
        }

        // MaxLength validation
        if (validators.maxLength !== undefined && stringValue.length > validators.maxLength) {
            return { type: 'maxLength' };
        }

        // Min validation (numeric)
        if (validators.min !== undefined && !isNaN(numericValue) && numericValue < validators.min) {
            return { type: 'min' };
        }

        // Max validation (numeric)
        if (validators.max !== undefined && !isNaN(numericValue) && numericValue > validators.max) {
            return { type: 'max' };
        }

        // Pattern validation
        if (validators.pattern && !validators.pattern.test(stringValue)) {
            return { type: 'pattern' };
        }

        return undefined;
    }, []);

    const _validateAllFields = useCallback(() => {
        if (!_internalValue || !_config) return;

        const newErrors: Record<string, { type: string } | undefined> = {};

        const fieldConfigs: Array<[string, IFieldOption]> = Object.entries(_config) as any;

        fieldConfigs.forEach(([fieldName, fieldConfig]) => {
            const value = (_internalValue as any)[fieldName];
            const error = _validateField(fieldName, value, fieldConfig.validators);
            newErrors[fieldName] = error;
        });

        _errorsSetter(newErrors);
    }, [_internalValue, _config, _validateField]);

    useEffect(() => {
        _internalValueSetter(_toFormValue(_config, _externalValue));
    }, [_config, _externalValue, _toFormValue]);

    useEffect(() => {
        const newExternalValue = _fromFormValue(_config, _internalValue);
        if (JSON.stringify(newExternalValue) !== JSON.stringify(previousExternalValueRef.current)) {
            previousExternalValueRef.current = newExternalValue;
            onChange?.(newExternalValue);
        }
    }, [_config, _internalValue, _fromFormValue]);

    // Validate fields when internal value changes
    useEffect(() => {
        _validateAllFields();
    }, [_validateAllFields]);

    const _onInputChange: ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement> = (e) => {
        const { name, value } = e.target;

        const newInternalValue = {
            ..._internalValue,
            [name]: value
        } as TInternalData;

        _internalValueSetter(newInternalValue);

        // Validate the specific field that changed
        const fieldConfig = _config[name as keyof TExternalData];
        if (fieldConfig) {
            const error = _validateField(name, value, fieldConfig.validators);
            _errorsSetter(prevErrors => ({
                ...prevErrors,
                [name]: error
            }));
        }
    };

    const _onSelectChange = (e: any) => {
        const { name, value } = e.target;

        const newInternalValue = {
            ..._internalValue,
            [name]: value
        } as TInternalData;

        _internalValueSetter(newInternalValue);

        // Validate the specific field that changed
        const fieldConfig = _config[name as keyof TExternalData];
        if (fieldConfig) {
            const error = _validateField(name, value, fieldConfig.validators);
            _errorsSetter(prevErrors => ({
                ...prevErrors,
                [name]: error
            }));
        }
    };

    const _onInputTypeCheckboxChange: ChangeEventHandler<HTMLInputElement> = (e) => {
        const { name, checked } = e.target;

        const newInternalValue = {
            ..._internalValue,
            [name]: checked
        } as TInternalData;

        _internalValueSetter(newInternalValue);

        // Validate the specific field that changed
        const fieldConfig = _config[name as keyof TExternalData];
        if (fieldConfig) {
            const error = _validateField(name, checked, fieldConfig.validators);
            _errorsSetter(prevErrors => ({
                ...prevErrors,
                [name]: error
            }));
        }
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', width: '100%' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: theme.spacing(4), alignItems: 'stretch' }}>
                {_layout.map((row, rowNumber) =>
                    <Box key={rowNumber} sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'stretch', gap: theme.spacing(2) }}>
                        {row.map((name: any, index: number) => {
                            if (typeof name === 'function') {
                                return (
                                    <Box key={index} sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                                        {_internalValue ? name(_internalValue) : <></>}
                                    </Box>
                                );
                            }

                            const fieldOptions = _config[name as keyof TExternalData];
                            const { label, type, validators, options, disabled, className, placeholder, multiple } = fieldOptions || {};

                            return (
                                <Box key={name as string} sx={{ flex: '1 1 15rem', minWidth: '15rem' }}>
                                    {(() => {
                                        const id = `${name}-${index}-${Date.now()}`;
                                        const fieldError = _errors[name as string];
                                        const hasError = !!fieldError;
                                        const errorMessage = hasError ? getErrorMessage(fieldError, validators) : '';

                                        if (!_internalValue) {
                                            return <></>;
                                        }

                                        switch (type) {
                                            case 'select':
                                                const _options = ((typeof options === 'function') ? options(_internalValue) : options) || [];
                                                return (
                                                    <FormControl fullWidth disabled={disabled} error={hasError}>
                                                        <InputLabel id={`${id}-label`}>{label}</InputLabel>
                                                        <Select
                                                            labelId={`${id}-label`}
                                                            id={id}
                                                            multiple={multiple}
                                                            name={name}
                                                            value={(_internalValue as any)[name] || ''}
                                                            onChange={_onSelectChange}
                                                            label={label}
                                                        >
                                                            {_options.map((option, optionIndex) => (
                                                                <MenuItem value={option.value} key={`${name}-${optionIndex}`}>
                                                                    {option.display}
                                                                </MenuItem>
                                                            ))}
                                                        </Select>
                                                        <FormHelperText sx={{ minHeight: theme.spacing(2.5) }}>
                                                            {hasError ? errorMessage : ' '}
                                                        </FormHelperText>
                                                    </FormControl>
                                                );

                                            case 'checkbox':
                                                return (
                                                    <Box>
                                                        <FormControlLabel
                                                            control={
                                                                <Checkbox
                                                                    id={id}
                                                                    name={name}
                                                                    checked={(_internalValue as any)[name] || false}
                                                                    onChange={_onInputTypeCheckboxChange}
                                                                    disabled={disabled}
                                                                    color={hasError ? 'error' : 'primary'}
                                                                />
                                                            }
                                                            label={label}
                                                        />
                                                        <Typography
                                                            variant="caption"
                                                            color={hasError ? "error" : "transparent"}
                                                            sx={{
                                                                display: 'block',
                                                                mt: theme.spacing(0.5),
                                                                minHeight: theme.spacing(2.5),
                                                                visibility: hasError ? 'visible' : 'hidden'
                                                            }}
                                                        >
                                                            {hasError ? errorMessage : 'Placeholder'}
                                                        </Typography>
                                                    </Box>
                                                );

                                            case 'color':
                                                return (
                                                    <Box sx={{ border: 1, borderRadius: theme.shape.borderRadius, p: theme.spacing(2) }}>
                                                        <Typography variant="body2" gutterBottom>{label}</Typography>
                                                        <TextField
                                                            id={id}
                                                            type="color"
                                                            name={name}
                                                            value={(_internalValue as any)[name] || ''}
                                                            onChange={_onInputChange}
                                                            disabled={disabled}
                                                            placeholder={placeholder}
                                                            fullWidth
                                                            error={hasError}
                                                            helperText={errorMessage || ' '}
                                                            sx={{ mt: theme.spacing(1) }}
                                                        />
                                                    </Box>
                                                );

                                            case 'number':
                                                return (
                                                    <TextField
                                                        id={id}
                                                        type="number"
                                                        name={name}
                                                        label={label}
                                                        value={(_internalValue as any)[name] || 0}
                                                        onChange={_onInputChange}
                                                        disabled={disabled}
                                                        placeholder={placeholder}
                                                        fullWidth
                                                        error={hasError}
                                                        helperText={errorMessage || ' '}
                                                        inputProps={{ step: 'any' }}
                                                    />
                                                );

                                            case 'hidden':
                                                return (
                                                    <TextField
                                                        id={id}
                                                        type="hidden"
                                                        name={name}
                                                        value={(_internalValue as any)[name] || ''}
                                                        onChange={_onInputChange}
                                                        disabled={disabled}
                                                        sx={{ display: 'none' }}
                                                    />
                                                );

                                            case 'display':
                                                return (
                                                    <Box>
                                                        <Typography variant="body2" gutterBottom>
                                                            {label}
                                                        </Typography>
                                                        <Box
                                                            sx={{
                                                                p: theme.spacing(2),
                                                                border: 1,
                                                                borderRadius: theme.shape.borderRadius
                                                            }}
                                                        >
                                                            {(_internalValue as any)[name] || ''}
                                                        </Box>
                                                        <TextField
                                                            id={id}
                                                            type="hidden"
                                                            name={name}
                                                            value={(_internalValue as any)[name] || ''}
                                                            onChange={_onInputChange}
                                                            disabled={disabled}
                                                            sx={{ display: 'none' }}
                                                        />
                                                    </Box>
                                                );

                                            default:
                                                return (
                                                    <TextField
                                                        id={id}
                                                        type={type}
                                                        name={name}
                                                        label={label}
                                                        value={(_internalValue as any)[name] || ''}
                                                        onChange={_onInputChange}
                                                        disabled={disabled}
                                                        placeholder={placeholder}
                                                        fullWidth
                                                        error={hasError}
                                                        helperText={errorMessage || ' '}
                                                    />
                                                );
                                        }
                                    })()}
                                </Box>
                            );
                        })}
                    </Box>
                )}

                {children}
            </Box>
        </Box>
    );
}