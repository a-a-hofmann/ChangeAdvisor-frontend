import React, {Component} from 'react';
import './App.css';
import DistributionPieChart from "../pie-chart/PieChart";
import Labels from "../label/Labels";
import axios from 'axios';
import Constants from '../Constants';
import PayloadForm from "../payload-form/PayloadForm";
import CategoryTable from "../category-table/CategoryTable";
import SelectAProjectComponent from "./SelectAProjectComponent";
import TimeSeries from "../timeseries/TimeSeries";
import moment from 'moment';

class App extends Component {

    constructor() {
        super();

        this.state = {
            projectId: null,
            data: [],
            isLoading: false,
            formData: {limit: 10, ngrams: 1},
            numberOfReviewsForLabels: 1000,
            responseTime: 1,
            totalReviews: 1,
            labels: [],
            selectedLabel: null,
            reviewCounts: [],
            averages: [],
            isServerUp: true,
            timeSeriesRange: null
        };
        this.componentDidMount.bind(this);
        this.handleFormSubmit.bind(this);
    }

    componentDidMount() {
        const param = this.props.match.match.params;
        const projectId = param.id;

        if (!this.props.project) {
            this.loadProject(projectId);
        }

        this.setState({projectId: projectId});

        this.loadTopReviews(projectId);
        this.loadDistributionData(projectId);
        this.loadTimeSeriesData(projectId);
    }

    loadProject(projectId) {
        const loadProject = axios.get(`${Constants.SERVER_URL}/projects/${projectId}`);
        loadProject.then(response => {
            this.setState({isServerUp: true, project: response.data});
        }).catch(error => {
            console.log(error);
            this.setState({isServerUp: false});
        });
    }

    loadDistributionData(projectId) {
        const promise = axios.get(`${Constants.SERVER_URL}/reviews/${projectId}/distribution?countOnly=true`);
        promise.then(res => {
            const responseBody = res.data;
            const distribution = responseBody.distribution
                .map(obj => ({
                    label: obj.category,
                    value: obj.reviewCount
                }));

            this.setState({data: distribution, totalReviews: responseBody.totalReviews});
        });
    }

    loadTimeSeriesData(projectId) {
        const promise = axios.get(`${Constants.SERVER_URL}/reviews/${projectId}/time`);
        promise.then(response => {
            const data = response.data;

            const reviews = data.map(point => (
                [isoStringToMillis(point.reviewDate), point.reviewCount]
            ));

            const averages = data.map(point => (
                [isoStringToMillis(point.reviewDate), point.average]
            ));

            this.setState({reviewCounts: reviews, averages: averages});

        });
    }

    handleFormSubmit(formData) {
        const self = this;
        this.setState({formData: formData}, function () {
            self.loadTopReviews(self.state.projectId);
        });
    }

    onRangeSet(range) {
        this.setState({timeSeriesRange: range})
    }

    selectedLabel(label) {
        this.setState({selectedLabel: label});
    }

    loadTopReviews(projectId) {
        const payload = {
            app: projectId,
            limit: this.state.formData.limit,
            ngrams: this.state.formData.ngrams
        };

        this.setState({
            isLoading: true
        }, function () {
            const start = Date.now();

            const promise = axios.post(`${Constants.SERVER_URL}/reviews/labels`, payload);
            promise.then(res => {
                const labels = res.data;
                this.setState({
                    data: this.state.data,
                    labels: labels,
                    isLoading: false
                });
                const elapsed = (Date.now() - start) / 1000.0;

                const numberOfReviewsForLabels = this.state.labels.reduce((sum, value) => sum + value.reviewCount, 0);
                this.setState({
                    responseTime: elapsed,
                    numberOfReviewsForLabels: numberOfReviewsForLabels
                });
            });
        });
    }

    render() {
        const project = this.props.project || this.state.project;

        if (!project) {
            return <SelectAProjectComponent/>;
        }

        const reviewCounts = this.state.reviewCounts;
        const avgRatings = this.state.averages;

        let maxRange = moment();
        let minRange = moment();
        let reviewsInInterval = 0;
        let averageInInterval = 0.0;

        const range = this.state.timeSeriesRange;
        if (range) {
            minRange = range.min;
            maxRange = range.max;

            const rangeFilter = (review => review[0] >= minRange && review[0] <= maxRange);

            reviewsInInterval = reviewCounts
                .filter(rangeFilter)
                .map(review => review[1])
                .reduce(add, 0);

            const ratingsInInterval = avgRatings.filter(rangeFilter);
            averageInInterval = average(ratingsInInterval);
        } else if (reviewCounts.length > 0) {
            minRange = reviewCounts[0][0];
            maxRange = reviewCounts[reviewCounts.length - 1][0];

            reviewsInInterval = reviewCounts.map(item => item[1]).reduce(add, 0);
            averageInInterval = average(avgRatings);
        }

        return (
            <div className={"col-md-12"}>
                <div className={"row"}>
                    <div className={"col-md-12"}>
                        <h3>{project.appName}</h3>
                    </div>
                </div>

                <br/>

                <div className={"row card-deck"}>
                    <div className={"card card-shadow"}>
                        <div className={"card-body"}>
                            <div className={"row"}>
                                <div className={"col-md-2"}>
                                    <h5>Interval: <br/>
                                        {moment(minRange).format('L')} - {moment(maxRange).format('L')}</h5>
                                    <h6># Reviews: {reviewsInInterval}</h6>
                                    <h6>Avg rating: {averageInInterval.toFixed(2)}</h6>
                                </div>

                                <div className={"col-md-10"}>
                                    <TimeSeries averages={avgRatings} reviewCounts={reviewCounts}
                                                onRangeSet={(range) => this.onRangeSet(range)}/>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <br/>

                <div className={"row card-deck"}>
                    <div className={"card card-shadow"}>
                        <div className={"card-body"}>
                            <PayloadForm value={this.state.formData}
                                         handleSubmit={(formData) => this.handleFormSubmit(formData)}/>
                        </div>
                    </div>
                </div>

                <br/>

                <div className={"row card-deck"}>
                    <div className={"col-md-3 card card-shadow"}>
                        <div className={"card-body"}>
                            <DistributionPieChart distribution={this.state.data} viewBoxWidth={50}/>
                            <hr/>
                            <h4>Total Reviews: {this.state.totalReviews}</h4>
                            {
                                <p className={"form-text text-muted"}>{this.state.formData.limit} Labels for a total
                                    of {this.state.numberOfReviewsForLabels} Reviews
                                    ({this.state.responseTime}
                                    seconds)</p>
                            }

                            <Labels isLoading={this.state.isLoading} labels={this.state.labels}
                                    onClick={(label) => this.selectedLabel(label)}/>
                        </div>
                    </div>

                    <div className={"col-md-9 card card-shadow"}>
                        <div className={"card-body"}>
                            {this.state.selectedLabel &&
                            <h3 className={"card-title"}>Label: {this.state.selectedLabel.label}</h3>
                            }
                            <CategoryTable
                                project={project}
                                label={this.state.selectedLabel}
                                gotoClassesClicked={(result) => this.props.gotoClassesClicked(result)}/>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

const add = (a, b) => a + b;

function average(list) {
    const sum = list.map(item => item[1]).reduce(add, 0);
    return sum / list.length;
}

function isoStringToMillis(isoDate) {
    return moment(isoDate).unix() * 1000;
}

export default App;
