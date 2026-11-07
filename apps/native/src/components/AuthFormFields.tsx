import React from "react";
import { View, StyleSheet } from "react-native";
import {
  useForm,
  Controller,
  type FieldValues,
  type DefaultValues,
  type Path,
} from "react-hook-form";

import { zodResolver } from "@hookform/resolvers/zod";
import type { ZodType } from "zod";

import { AuthInput, type AuthInputProps } from "@repo/ui";

export type FieldConfig<T> = {
  name: keyof T & string;
} & AuthInputProps;

type AuthFormFieldsProps<T extends FieldValues> = {
  schema: ZodType<T, T>;
  defaultValues: DefaultValues<T>;
  fields: FieldConfig<T>[];
  onSubmit: (values: T) => void | Promise<void>;
  extraRow?: React.ReactNode;
  renderSubmit: (submit: () => void) => React.ReactNode;
};

const AuthFormFields = <T extends FieldValues>({
  schema,
  defaultValues,
  fields,
  onSubmit,
  extraRow,
  renderSubmit,
}: AuthFormFieldsProps<T>) => {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<T>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues,
  });

  return (
    <View style={styles.formContainer}>
      {fields.map((f) => (
        <Controller
          key={f.name}
          control={control}
          name={f.name as Path<T>}
          render={({ field }) => {
            const value = field.value;
            const error = errors[f.name]?.message as string | undefined;
            return (
              <AuthInput
                label={f.label}
                icon={f.icon}
                placeholder={f.placeholder}
                value={value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={error}
                secureTextEntry={f.secureTextEntry}
                keyboardType={f.keyboardType}
                autoCapitalize={f.autoCapitalize}
              />
            );
          }}
        />
      ))}

      {extraRow}

      {renderSubmit(() => {
        void handleSubmit(onSubmit)();
      })}
    </View>
  );
};

export default AuthFormFields;

const styles = StyleSheet.create({
  formContainer: {
    backgroundColor: "transparent",
    borderRadius: 12,
  },
});
