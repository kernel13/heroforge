/**
 * The layout vocabulary the exported sheet is built from.
 *
 * The paper form says the same three things over and over: a labelled box holding one value, a
 * heading over a group of them, and a row of component boxes summing into a total. Those are the
 * primitives here. Every component is presentation only — none of them computes anything.
 */
import { StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/stylesheet";
import type { ReactNode } from "react";
import { COLOR, FONT } from "./theme";

const styles = StyleSheet.create({
  sectionHeading: {
    fontFamily: FONT.bold,
    fontSize: 7.5,
    letterSpacing: 1.1,
    color: COLOR.accent,
    textTransform: "uppercase",
    paddingBottom: 2,
    borderBottom: `1pt solid ${COLOR.accent}`,
  },
  section: { marginBottom: 6 },
  sectionBody: { marginTop: 3 },

  subHeading: {
    fontFamily: FONT.bold,
    fontSize: 6,
    letterSpacing: 0.7,
    color: COLOR.inkSoft,
    textTransform: "uppercase",
    marginBottom: 2,
  },

  fieldLabel: {
    fontFamily: FONT.body,
    fontSize: 5,
    letterSpacing: 0.55,
    color: COLOR.inkSoft,
    textTransform: "uppercase",
    marginBottom: 1.5,
  },
  box: {
    border: `0.5pt solid ${COLOR.rule}`,
    backgroundColor: COLOR.card,
    borderRadius: 2,
    paddingVertical: 2.5,
    paddingHorizontal: 3,
    minHeight: 12,
    justifyContent: "center",
  },
  boxTotal: {
    borderWidth: 1,
    borderColor: COLOR.accent,
    backgroundColor: COLOR.accentSoft,
  },
  value: { fontFamily: FONT.body, fontSize: 8, color: COLOR.ink },
  valueTotal: { fontFamily: FONT.bold, fontSize: 10, color: COLOR.ink, textAlign: "center" },
  valueCentred: { textAlign: "center" },

  row: { flexDirection: "row", alignItems: "flex-end" },
  operator: {
    fontFamily: FONT.body,
    fontSize: 8,
    color: COLOR.inkSoft,
    marginHorizontal: 2.5,
    paddingBottom: 3,
  },

  note: {
    fontFamily: FONT.italic,
    fontSize: 5.5,
    color: COLOR.inkSoft,
    marginTop: 2,
    lineHeight: 1.3,
  },

  ruledLine: {
    borderBottom: `0.5pt solid ${COLOR.rule}`,
    minHeight: 10.5,
    justifyContent: "flex-end",
    paddingBottom: 1.5,
  },
  ruledText: { fontFamily: FONT.body, fontSize: 7.5, color: COLOR.ink },
});

/**
 * A heading over a group of fields.
 *
 * Sections do not split across pages by default — a saving-throw block with its total on one page
 * and its components on the next is worse than a short page. `wrap` opts the long, list-shaped
 * sections (possessions, attacks, the skills continuation) back into breaking, because those have
 * no length a page can be sized around.
 */
export function Section({
  title,
  children,
  style,
  wrap = false,
}: {
  title: string;
  children: ReactNode;
  style?: Style;
  wrap?: boolean;
}) {
  return (
    <View style={[styles.section, style ?? {}]} wrap={wrap}>
      <Text style={styles.sectionHeading}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

export function SubHeading({ children }: { children: string }) {
  return <Text style={styles.subHeading}>{children}</Text>;
}

export function Note({ children }: { children: ReactNode }) {
  return <Text style={styles.note}>{children}</Text>;
}

/**
 * A labelled box. `total` marks the box the paper form prints heavier — the one value on the line
 * a player reads during play, as against the components that make it up.
 */
export function Field({
  label,
  value,
  total = false,
  centred = false,
  flex,
  width,
}: {
  label: string;
  value: string | number;
  total?: boolean;
  centred?: boolean;
  flex?: number;
  width?: number;
}) {
  const sizing = width !== undefined ? { width } : { flex: flex ?? 1 };
  return (
    <View style={[sizing, { marginRight: 4 }]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.box, total ? styles.boxTotal : {}]}>
        <Text
          style={[
            total ? styles.valueTotal : styles.value,
            centred && !total ? styles.valueCentred : {},
          ]}
        >
          {String(value)}
        </Text>
      </View>
    </View>
  );
}

/** A field with no box — the identity line's ruled blanks. */
export function RuledField({
  label,
  value,
  flex,
  width,
}: {
  label: string;
  value: string;
  flex?: number;
  width?: number;
}) {
  const sizing = width !== undefined ? { width } : { flex: flex ?? 1 };
  return (
    <View style={[sizing, { marginRight: 8 }]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.ruledLine}>
        <Text style={styles.ruledText}>{value}</Text>
      </View>
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: Style }) {
  return <View style={[styles.row, style ?? {}]}>{children}</View>;
}

/**
 * `total = a + b + c`, laid out the way the form asks a player to check the arithmetic: the total
 * first, then each component that fed it.
 *
 * The operators are drawn, not computed. Every number in `parts` already carries its own sign from
 * the rules engine — an armour check penalty prints as −5 and is *added*, which is exactly what the
 * engine did to reach the total.
 */
export function Formula({
  label,
  total,
  parts,
  labelWidth = 62,
}: {
  label: string;
  total: string | number;
  parts: { label: string; value: string | number }[];
  labelWidth?: number;
}) {
  return (
    <Row style={{ marginBottom: 2 }}>
      <View style={{ width: labelWidth, paddingBottom: 3 }}>
        <Text style={styles.subHeading}>{label}</Text>
      </View>
      <Field label="Total" value={total} total width={34} />
      <Text style={styles.operator}>=</Text>
      {parts.map((part, index) => (
        <View key={part.label} style={[styles.row, { flex: 1 }]}>
          {index > 0 && <Text style={styles.operator}>+</Text>}
          <Field label={part.label} value={part.value} centred flex={1} />
        </View>
      ))}
    </Row>
  );
}

export { styles as primitiveStyles };
