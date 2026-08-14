const {
  NumberField,
  SchemaField
} = foundry.data.fields;

export function numberField({ initial = 0, min = 0, max = null } = {}) {
  const options = {
    required: true,
    integer: true,
    min,
    initial
  };

  if (max !== null) options.max = max;
  return new NumberField(options);
}

export function signedNumberField({ initial = 0 } = {}) {
  return new NumberField({ required: true, integer: true, initial });
}

export function resourceField({ value = 0, max = 0, cap = null } = {}) {
  return new SchemaField({
    min: numberField({ initial: 0 }),
    value: numberField({ initial: value }),
    max: numberField({ initial: max, max: cap })
  });
}

export function valueMapSchema(source, initial = 0) {
  return new SchemaField(
    Object.fromEntries(
      Object.keys(source).map((key) => [
        key,
        new SchemaField({
          value: numberField({ initial })
        })
      ])
    )
  );
}
