import { Button, Checkbox, Form, Modal } from 'antd';
import React, { useState } from 'react';
import './ConfirmDialog.scss';
import { useForm } from 'antd/lib/form/Form';
import TextArea from 'antd/lib/input/TextArea';

interface IConfirmDialog {
  showDialog: boolean;
  Icon: any;
  message: string;
  subMessage?: string;
  showCheckbox?: boolean;
  checkboxText?: string;
  okText: string;
  cancelText: string;
  okAction?: (remarks?: string) => void;
  closeDialog: () => void;
  isReject: boolean; // if true modal is a reject action modal
  getRemarks?: boolean;
}
const ConfirmDialog = (props: IConfirmDialog) => {
  const {
    showDialog,
    Icon,
    message,
    subMessage,
    showCheckbox,
    checkboxText,
    okText,
    cancelText,
    okAction,
    closeDialog,
    isReject,
    getRemarks,
  } = props;

  const [form] = useForm();

  const [isChecked, setIsChecked] = useState<boolean>(showCheckbox || false);

  return (
    <>
      <Modal
        open={showDialog}
        title={null}
        footer={null}
        className="dialog-box"
        onCancel={closeDialog}
      >
        <div>{Icon}</div>
        <h4 className="message">{message}</h4>
        {/* {subMessage && !getRemarks && <p className="subMessage">{subMessage}</p>} */}

        {/* {getRemarks && (
        <Form form={form} layout="vertical" className="mg-top-1 mg-bottom-1">
          <Form.Item name="remarks" label="Remarks">
            <TextArea rows={3} />
          </Form.Item>
        </Form>
      )} */}

        {/* {showCheckbox && (
        <div className="checkbox-row" onClick={() => setIsChecked((prev) => prev)}>
          <Checkbox checked={isChecked} onChange={(e) => setIsChecked(e.target.checked)} />
          <p>{checkboxText}</p>
        </div>
      )} */}
        <div className="modal-actions">
          <Button onClick={closeDialog} color="#3A354180">
            {cancelText}
          </Button>

          <Button
            danger={isReject}
            type={'primary'}
            disabled={!isChecked}
            onClick={() => {
              if (getRemarks && okAction && form.getFieldValue('remarks')) {
                okAction(form.getFieldValue('remarks'));
              }
              if (okAction) {
                okAction();
              }

              closeDialog();
            }}
          >
            {okText}
          </Button>
        </div>
      </Modal>
    </>
  );
};

export default ConfirmDialog;
