/*
  TimelineList
  - Renders a list of steps using TimelineStep
  - Props:
    steps: Array<{ key, title, description?, summary?, state, actionLabel?, onAction? }>
*/
import React from 'react';
import { View } from 'react-native';
import TimelineStep from './TimelineStep';

const TimelineList = ({ steps }) => {
    return (
        <View style={{ alignSelf: 'stretch' }}>
            {steps.map((s, idx) => (
                <React.Fragment key={s.key}>
                    <TimelineStep
                        index={idx + 1}
                        title={s.title}
                        description={s.description}
                        summary={s.summary}
                        state={s.state}
                        actionLabel={s.actionLabel}
                        onAction={s.onAction}
                    />
                    {idx < steps.length - 1 && (
                        <View style={{ height: 1, backgroundColor: '#EDEDED', marginLeft: 40 }} />
                    )}
                </React.Fragment>
            ))}
        </View>
    );
};

export default TimelineList;


