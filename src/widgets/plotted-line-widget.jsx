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

var MultiButtonGroup = require("react-components/multi-button-group.jsx");
var Graphie = require("../components/graphie.jsx");
var GraphSettings = require("../components/graph-settings.jsx");
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
    style: "",
    styleClass: "",
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

        var extraGraphProps = {
            onChange: (newProps) => {
                var correct = this.props.correct;
                if (correct.type === newProps.graph.type) {
                    correct = _.extend({}, correct, newProps.graph);
                } else {
                    // Clear options from previous graph
                    correct = newProps.graph;
                }
                this.props.onChange({correct: correct});
            },
            title: this.props.title,
        }
        var graphProps = _.extend({}, propDefaults.graph, this.props.graph, extraGraphProps);

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
                options={graphProps}
                box={this.props.graph.box}
                setup={this.setupGraphie} >
            {lineComponents}
            {pointCoordComponents}
        </Graphie>;
    },

    graphExpression: function(expression) {
        if (!expression) {
            return;
        }
        var parsed = KAS.parse(expression);
        if (!parsed || !parsed.expr) {
            console.error("Failed to parse " + expression);
            return;
        }
        var scale = this.savedGraphie.scale;
        var range = this.savedGraphie.range;
        var rangeX = range[0];
        var dimensions = this.savedGraphie.dimensions;
        var points = [];
        var graphVariable = parsed.expr.getVars()[0];
        for (var x = rangeX[0]; x <= rangeX[1]; x += (rangeX[1] - rangeX[0]) / 100) {
            var input = {};
            input[graphVariable] = x;
            var y = parsed.expr.eval(input);
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

    _slimLabel: function(s) {
        s = parseFloat(s.toPrecision(7));
        var slim = s.toString();
        if (slim.length > 7) {
            var digits = s.toExponential(2).split("e");
            var exponent = digits[1];
            if (Math.abs(exponent) > 2) {
                //minus sign spacing is strange, perhaps mistaken for operator
                slim = digits[0] + "\\scriptsize E{" + exponent.substring(0,1) + "}" + exponent.substring(1);
            } else {
                slim = s.toPrecision(3);
            }
        }
        return "\\small{" + slim + "}";
    },

    setupGraphie: function(graphie, options) {
        var gridConfig = this._getGridConfig(options);
        graphie.graphInit({
            range: options.range,
            scale: _.pluck(gridConfig, "scale"),
            axisArrows: "<->",
            labelFormat: this._slimLabel,
            gridStep: options.gridStep,
            tickStep: _.pluck(gridConfig, "tickStep"),
            labelStep: 1,
            unityLabels: _.pluck(gridConfig, "unityLabel")
        });

        var yLabelPosition = ((options.range[0][0] <= 0) && (0 <= options.range[0][1])) ? 0 : options.range[0][0];
        var xLabelPosition = ((options.range[1][0] <= 0) && (0 <= options.range[1][1])) ? 0 : options.range[1][0];
        graphie.label([options.range[0][1], xLabelPosition], options.labels[0], "right");
        graphie.label([yLabelPosition, options.range[1][1]], options.labels[1], "above");
        if (options.title) {
            var theLabel = graphie.label([(yLabelPosition + options.range[0][1]) / 2, options.range[1][1]],
                options.title, "center")[0];
            theLabel.style.marginTop = -theLabel.scrollHeight + "px";
        }

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
    
    changeLabel: function(i, e) {
        var labels = _.clone(this.props.labels);
        labels[i] = e.target.value;
        this.props.onChange({labels: labels});
    },

    changePointGraph: function(e) {
        this.props.onChange({
            pointGraph: e.target.value
        });
    },

    changeTitle: function(e) {
        this.props.onChange({
            title: e.target.value
        });
    },

    changeStyle: function(e) {
        this.props.onChange({
            style: e.target.value
        });
    },

    changeStyleClass: function(e) {
        this.props.onChange({
            styleClass: e.target.value
        });
    },

    render: function() {
        return <div>
            <GraphSettings
                editableSettings={["graph", "snap", "image"]}
                box={this.props.graph.box}
                range={this.props.graph.range}
                labels={this.props.graph.labels}
                step={this.props.graph.step}
                gridStep={this.props.graph.gridStep}
                snapStep={this.props.graph.snapStep}
                valid={this.props.graph.valid}
                markings={this.props.graph.markings}
                rulerLabel={this.props.graph.rulerLabel}
                rulerTicks={this.props.graph.rulerTicks}
                onChange={this.change("graph")} />
            <div className="perseus-widget-row">
                <label>Available functions:{' '} </label>
            </div>
            <div >
                <label>Title:{' '}
                    <input type="text"
                        onChange={this.changeTitle}
                        defaultValue={this.props.title} />
                </label>
            </div>
            <div >
                <label>Graph fit style:{' '}
                    <input type="text"
                        onChange={this.changePointGraph}
                        defaultValue={this.props.pointGraph} />
                </label>
            </div>
            <div >
                <label>Widget style:{' '}
                    <input type="text"
                        onChange={this.changeStyle}
                        defaultValue={this.props.style} />
                </label>
            </div>
            <div >
                <label>Widget style class:{' '}
                    <input type="text"
                        onChange={this.changeStyleClass}
                        defaultValue={this.props.styleClass} />
                </label>
            </div>
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
