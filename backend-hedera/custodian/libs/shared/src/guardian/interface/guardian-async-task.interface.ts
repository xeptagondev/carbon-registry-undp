export interface TaskSetInterface {
    taskId: string;
    expectation: number;
    action: string;
    userId: string;
}

export interface TaskResponseInterface {
    action: string;
    userId: number;
    expectation: string;
    taskId: string;
    statuses: any;
    result?: any;
    error?: any;
}
