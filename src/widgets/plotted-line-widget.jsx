/**
 * This is an plotted line widget
 *
 */

var React = require('react');
var _ = require("underscore");

var Util = require("../util.js");
var Changeable = require("../mixins/changeable.jsx");
var EditorJsonify = require("../mixins/editor-jsonify.jsx");
var WidgetJsonifyDeprecated = require("../mixins/widget-jsonify-deprecated.jsx");

var Graphie = require("../components/graphie.jsx");
var MovablePoint = Graphie.MovablePoint;
var MovableLine = Graphie.MovableLine;

var knumber = require("kmath").number;
var kpoint = require("kmath").point;

var defaultBoxSize = 400;

var propDefaults = {
    // We want to allow our coord to be null to test if the
    // user has interacted with this widget yet when grading it
    coord: null,
    pointCoords: [],
    pointGraph: "",
    lineCoords: [],
    graph: {
        box: [defaultBoxSize, defaultBoxSize],
        labels: ["x", "y"],
        range: [[-10, 10], [-10, 10]],
        step: [1, 1],
        gridStep: [1, 1],
        snapStep: [1, 1],
        valid: true,
        backgroundImage: null,
        markings: "grid",
        showProtractor: false
    }
};

/**
 * This is the widget's renderer. It shows up in the right column
 * in test.html, and is what is visible to users, and where
 * users enter their answers.
 */
var PlottedLineWidget = React.createClass({
    mixins: [Changeable, WidgetJsonifyDeprecated],

    propTypes: {
        graph: React.PropTypes.object.isRequired,
        coord: React.PropTypes.arrayOf(React.PropTypes.number)
    },

    getDefaultProps: function() {
        return propDefaults;
    },

    render: function() {
        var graphProps = {
            ref: "graph",
            box: this.props.box,
            range: this.props.range,
            labels: this.props.labels,
            step: this.props.step,
            gridStep: this.props.gridStep,
            snapStep: this.props.snapStep,
            graph: this.props.correct,
            backgroundImage: this.props.backgroundImage,
            markings: this.props.markings,
            showProtractor: this.props.showProtractor,
            showRuler: this.props.showRuler,
            rulerLabel: this.props.rulerLabel,
            rulerTicks: this.props.rulerTicks,
            flexibleType: true,
            onChange: (newProps) => {
                var correct = this.props.correct;
                if (correct.type === newProps.graph.type) {
                    correct = _.extend({}, correct, newProps.graph);
                } else {
                    // Clear options from previous graph
                    correct = newProps.graph;
                }
                this.props.onChange({correct: correct});
            }
        }
        _.defaults(graphProps, propDefaults.graph);

        var pointCoordComponents = null;
        if (this.props.pointCoords.length > 0) {
            pointCoordComponents = this.props.pointCoords.map(function(aCoord, index) {
                return <MovablePoint key={index} coord={aCoord}/>;
            });
        };
        var lineComponents = null;
        if (this.props.lineCoords.length == 2) {
            lineComponents = <MovableLine extendLine={true} >
                <MovablePoint coord={this.props.lineCoords[0] || [-1, 0]}
                    pointSize={0}
                />
                <MovablePoint coord={this.props.lineCoords[1] || [1, 0]}
                    pointSize={0}
                />
            </MovableLine>;
        };

        return <Graphie
                ref="graphie"
                box={this.props.graph.box}
                range={graphProps.range}
                labels={graphProps.labels}
                options={graphProps}
                setup={this.setupGraphie} >
            {lineComponents}
            {pointCoordComponents}
        </Graphie>;
    },

    graphExpression: function(expression) {
        if (!expression) {
            return;
        }
        var expr = KAS.parse(expression);
        if (!expr || !expr.expr) {
            console.error("Failed to parse " + expression);
            return;
        }
        var scale = this.savedGraphie.scale;
        var range = this.savedGraphie.range;
        var rangeX = range[0];
        var dimensions = this.savedGraphie.dimensions;
        var points = [];
        for (var x = rangeX[0]; x <= rangeX[1]; x += (rangeX[1] - rangeX[0]) / 100) {
            var y = expr.expr.eval({x: x});
            if (y) {
                points.push([x, y]);
            }
        }
        this.updatePointwiseGraph(points);
    },
    updatePointwiseGraph: function(points) {
        var newPath = this.savedGraphie.svgPointwisePath(points);
        this.smoothGraph.attr({ path: newPath });
    },
    updatePointGraph: function() {
        if (this.props.pointGraph == "curve") {
            var newPath = this.savedGraphie.svgPointwisePath(this.props.pointCoords);
            this.pointGraphPath.attr({ path: newPath });
        } else if (this.props.pointGraph == "line") {
            var newPath = this.savedGraphie.path(this.props.pointCoords);
            this.pointGraphPath.attr({ path: newPath });
        }
    },
    moveLine: function(newLinePair) {
        this.change({
            lineCoords: newLinePair
        });
    },
    movePoint: function(index, point) {
        var currentPoints = this.props.pointCoords;
        currentPoints[index] = point;
        this.change({
            pointCoords: currentPoints
        });
    },

    _getGridConfig: function(options) {
        return _.map(options.step, function(step, i) {
            return Util.gridDimensionConfig(
                    step,
                    options.range[i],
                    options.box[i],
                    options.gridStep[i]);
        });
    },

    setupGraphie: function(graphie, options) {
        var gridConfig = this._getGridConfig(options);
        graphie.graphInit({
            range: options.range,
            scale: _.pluck(gridConfig, "scale"),
            axisArrows: "<->",
            labelFormat: function(s) { return "\\small{" + s + "}"; },
            gridStep: options.gridStep,
            tickStep: _.pluck(gridConfig, "tickStep"),
            labelStep: 1,
            unityLabels: _.pluck(gridConfig, "unityLabel")
        });
        graphie.label([0, options.range[1][1]], options.labels[1], "above");
        this.savedGraphie = graphie;
        this.smoothGraph = graphie.pointwise([]);
        this.pointGraphPath = graphie.pointwise([]);
        try {
            this.updatePointGraph();
        } catch (e) {
            console.log(e);
        }
    },

    simpleValidate: function(rubric) {
        return PlottedLineWidgetWidget.validate(this.getUserInput(), rubric);
    }
});


/**
 * This is the widget's grading function
 */
_.extend(PlottedLineWidget, {
    validate: function(state, rubric) {
        if (state.coord == null) {
            return {
                type: "invalid",
                message: null
            };
        } else if (kpoint.equal(state.coord, rubric.correct)) {
            return {
                type: "points",
                earned: 1,
                total: 1,
                message: null
            };
        } else {
            return {
                type: "points",
                earned: 0,
                total: 1,
                message: null
            };
        }
    }
});


/**
 * This is the widget's editor. This is what shows up on the left side
 * of the screen in test.html. Only the question writer sees this.
 */
var PlottedLineWidgetEditor = React.createClass({
    mixins: [Changeable, EditorJsonify],

    getDefaultProps: function() {
        return {
            correct: [4, 4],
            graph: {
                box: [340, 340],
                labels: ["x", "y"],
                range: [[-10, 10], [-10, 10]],
                step: [1, 1],
                gridStep: [1, 1],
                valid: true,
                backgroundImage: null,
                markings: "grid",
                showProtractor: false
            }
        };
    },

    render: function() {
        return <div>
            <PlottedLineWidget
                graph={this.props.graph}
                coord={this.props.correct}
                onChange={this.handleChange} />
        </div>;
    },

    handleChange: function(newProps) {
        if (newProps.coord) {
            this.change({
                correct: newProps.coord
            });
        }
    }
});

/**
 * For this widget to work, we must export it.
 * We also must require() this file in src/all-widgets.js
 */
module.exports = {
    name: "plotted-line-widget",
    displayName: "Plotted Line Widget",
    hidden: true,   // Hides this widget from the Perseus.Editor widget select
    widget: PlottedLineWidget,
    editor: PlottedLineWidgetEditor
};
