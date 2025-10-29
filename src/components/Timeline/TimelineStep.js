/*
  TimelineStep
  - Renders a single step row for the Timeline list
  - Props:
    index (number): 1-based index for the step badge
    title (string): Step title
    description (string): Detailed copy when active
    summary (string): Concise summary when completed
    state ("todo" | "active" | "done" | "retry" | "blocked"): Visual state
    actionLabel (string?): Optional inline micro-action label
    onAction (() => void)?: Optional handler for inline micro-action
*/
import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import Colors from '../../globals/colors';

const badgeBgForState = (state) => {
    if (state === 'done') return '#E6F4EA';
    if (state === 'active') return '#E6F7FB';
    if (state === 'retry') return '#FDECEC';
    return '#F0F0F0';
};

const badgeFgForState = (state) => {
    if (state === 'done') return Colors.verusGreenColor;
    if (state === 'active') return Colors.primaryColor;
    if (state === 'retry') return Colors.warningButtonColor;
    return '#555';
};

const chipTextForState = (state) => {
    if (state === 'done') return 'DONE';
    if (state === 'active') return 'NEXT';
    if (state === 'retry') return 'RETRY';
    if (state === 'blocked') return 'BLOCKED';
    return 'TO DO';
};

const chipColorsForState = (state) => {
    if (state === 'done') return { bg: '#E6F4EA', fg: Colors.verusGreenColor };
    if (state === 'active') return { bg: '#E6F7FB', fg: Colors.primaryColor };
    if (state === 'retry') return { bg: '#FDECEC', fg: Colors.warningButtonColor };
    if (state === 'blocked') return { bg: '#F3F3F3', fg: '#999' };
    return { bg: '#F3F3F3', fg: '#666' };
};

const TimelineStep = ({ index, title, description, summary, state, actionLabel, onAction }) => {
    const chip = chipColorsForState(state);
    const showDescription = state === 'active' && !!description;
    const showSummary = state === 'done' && !!summary;

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: badgeBgForState(state), alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                <Text style={{ color: badgeFgForState(state), fontWeight: '700', fontSize: 13 }}>{index}</Text>
            </View>
            <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#1A1A1A' }}>{title}</Text>
                    <View style={{ flex: 1 }} />
                    <View style={{ paddingHorizontal: 8, height: 20, borderRadius: 10, backgroundColor: chip.bg, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: chip.fg }}>{chipTextForState(state)}</Text>
                    </View>
                </View>

                {showDescription && (
                    <Text style={{ fontSize: 13, color: '#555', lineHeight: 18, marginTop: 4 }}>{description}</Text>
                )}

                {showSummary && (
                    <Text style={{ fontSize: 12, color: '#666', lineHeight: 16 }}>{summary}</Text>
                )}
            </View>
        </View>
    );
};

export default TimelineStep;


